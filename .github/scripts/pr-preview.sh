#!/usr/bin/env bash
# PR preview helper for .github/workflows/pr-preview.yml.
#
# Previews live on the "pr-previews" branch as pr-<N>/ folders and are served
# from GitHub Pages at <pages-url>/pr-preview/pr-<N>/ (see deploy.yml).
#
#   pr-preview.sh check            <pr.json>   -> outputs: number, publish, reason
#   pr-preview.sh publish          <N> <sha> <site-dir>  -> outputs: changed, expires
#   pr-preview.sh remove           <N> <reason>          -> outputs: changed, removed
#   pr-preview.sh expire                                 -> outputs: changed, removed
#   pr-preview.sh url              <N>       -> prints the preview URL
#   pr-preview.sh wait-live        <N> <sha> -> outputs: live (true once the deployed preview is <sha>)
#   pr-preview.sh status           <sha> <state> <description> [target-url]
#   pr-preview.sh comment-deploying <N> <sha> <run-url>
#   pr-preview.sh comment-failed    <N> <sha> <run-url>
#   pr-preview.sh comment-published <N> <sha> <expires>
#   pr-preview.sh comment-removed   "<N:reason> [N:reason ...]"
#   pr-preview.sh comment-skipped   <N> <reason>
#
# Requires: GH_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT; gh, git, jq.
set -euo pipefail

REPO=${GITHUB_REPOSITORY:?}
BRANCH="pr-previews"
TTL_DAYS=7
MARKER="<!-- pr-preview-bot -->"
STATUS_CONTEXT="PR preview"
SPINNER_URL="https://raw.githubusercontent.com/${REPO}/${DEFAULT_BRANCH:-main}/.github/assets/deploying.gif"
AUTH_URL="https://x-access-token:${GH_TOKEN:?}@github.com/${REPO}.git"

owner=${REPO%%/*}
name=${REPO#*/}
if [ "${name,,}" = "${owner,,}.github.io" ]; then
  PAGES_URL="https://${name,,}"
else
  PAGES_URL="https://${owner,,}.github.io/${name}"
fi

out() { echo "$1=$2" >> "$GITHUB_OUTPUT"; echo "output: $1=$2"; }
preview_url() { echo "${PAGES_URL}/pr-preview/pr-$1/"; }

clone_previews() {
  rm -rf previews
  if git ls-remote --exit-code --heads "$AUTH_URL" "$BRANCH" >/dev/null 2>&1; then
    git clone --quiet --depth 1 --branch "$BRANCH" "$AUTH_URL" previews
  else
    git init --quiet previews
    git -C previews checkout --quiet --orphan "$BRANCH"
    git -C previews remote add origin "$AUTH_URL"
    printf '# PR previews\n\nManaged by .github/workflows/pr-preview.yml. Do not edit.\n' > previews/README.md
  fi
  git -C previews config user.name "github-actions[bot]"
  git -C previews config user.email "41898282+github-actions[bot]@users.noreply.github.com"
}

push_previews() {
  git -C previews add -A
  if git -C previews diff --cached --quiet; then
    return 1
  fi
  git -C previews commit --quiet -m "$1"
  # Several runs may push at once; each touches only its own pr-<N>/ folder,
  # so rebasing onto the latest branch and retrying never conflicts.
  local attempt
  for attempt in 1 2 3 4 5; do
    if git -C previews push --quiet origin "HEAD:$BRANCH" 2>/dev/null; then
      return 0
    fi
    echo "push rejected (attempt $attempt); rebasing onto latest $BRANCH"
    git -C previews fetch --quiet origin "$BRANCH"
    git -C previews rebase --quiet "origin/$BRANCH"
    sleep "$attempt"
  done
  git -C previews push --quiet origin "HEAD:$BRANCH"
}

upsert_comment() {
  local number=$1 body=$2 id
  id=$(gh api --paginate "repos/$REPO/issues/$number/comments" \
    --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | contains(\"$MARKER\"))) | .id" | head -n1)
  if [ -n "$id" ]; then
    gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$body" >/dev/null
    echo "updated comment $id on #$number"
  else
    gh api -X POST "repos/$REPO/issues/$number/comments" -f body="$body" >/dev/null
    echo "created comment on #$number"
  fi
}

cmd=${1:?command}
shift

case "$cmd" in
  check)
    # pr.json comes from the untrusted PR run: only the number is used, and it
    # is validated and cross-checked against the API and the trusted event.
    number=$(jq -r '.number' "$1")
    [[ "$number" =~ ^[0-9]+$ ]] || { echo "invalid PR number: $number" >&2; exit 1; }
    out number "$number"

    pr=$(gh api "repos/$REPO/pulls/$number")
    state=$(jq -r .state <<<"$pr")
    head_sha=$(jq -r .head.sha <<<"$pr")
    login=$(jq -r .user.login <<<"$pr")
    assoc=$(jq -r .author_association <<<"$pr")

    if [ "$state" != "open" ]; then
      out publish false; out reason closed; exit 0
    fi
    if [ "$head_sha" != "${RUN_HEAD_SHA:?}" ]; then
      echo "run is for ${RUN_HEAD_SHA}, PR head is now ${head_sha}; a newer run will publish."
      out publish false; out reason stale; exit 0
    fi
    case "$assoc" in
      OWNER|MEMBER|COLLABORATOR) ;;
      *) out publish false; out reason "untrusted:$login"; exit 0 ;;
    esac
    out publish true; out reason ok
    ;;

  publish)
    number=$1 sha=$2 site=$3
    [[ "$number" =~ ^[0-9]+$ ]] || exit 1
    expires=$(date -u -d "+${TTL_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)
    clone_previews
    dir="previews/pr-$number"
    rm -rf "$dir"
    mkdir -p "$dir"
    cp -r "$site"/. "$dir"/
    find "$dir" -name .git -prune -exec rm -rf {} +
    # Keep previews out of search engines.
    if [ -f "$dir/index.html" ]; then
      sed -i 's#<meta name="robots" content="[^"]*"#<meta name="robots" content="noindex, nofollow"#' "$dir/index.html"
      grep -q 'name="robots"' "$dir/index.html" ||
        sed -i 's#<head>#<head>\n    <meta name="robots" content="noindex, nofollow" />#' "$dir/index.html"
    fi
    jq -n --argjson pr "$number" --arg sha "$sha" --arg expires "$expires" \
      --arg updated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{pr: $pr, sha: $sha, updated: $updated, expires: $expires}' > "$dir/preview.json"
    if push_previews "Preview for #$number at ${sha:0:7}"; then
      out changed true
    else
      out changed false
    fi
    out expires "$expires"
    ;;

  remove)
    number=$1 reason=$2
    [[ "$number" =~ ^[0-9]+$ ]] || exit 1
    clone_previews
    rm -rf "previews/pr-$number"
    if push_previews "Remove preview for #$number ($reason)"; then
      out changed true; out removed "$number:$reason"
    else
      out changed false; out removed ""
    fi
    ;;

  expire)
    clone_previews
    now=$(date -u +%s)
    removed=""
    for meta in previews/pr-*/preview.json; do
      [ -f "$meta" ] || continue
      expires=$(jq -r .expires "$meta")
      if [ "$(date -u -d "$expires" +%s)" -le "$now" ]; then
        number=$(basename "$(dirname "$meta")"); number=${number#pr-}
        rm -rf "previews/pr-$number"
        removed="$removed $number:expired"
      fi
    done
    if push_previews "Remove expired previews:$removed"; then
      out changed true
    else
      out changed false
    fi
    out removed "${removed# }"
    ;;

  url)
    preview_url "$1"
    ;;

  wait-live)
    # A deploy can be superseded by a newer one that also contains this
    # preview, so check what is actually live rather than the job result.
    number=$1 sha=$2
    meta="$(preview_url "$number")preview.json"
    for _ in $(seq 1 60); do
      live=$(curl -fsS "$meta?t=$(date +%s%N)" 2>/dev/null | jq -r '.sha // empty' || true)
      if [ "$live" = "$sha" ]; then
        out live true; exit 0
      fi
      sleep 5
    done
    echo "preview for #$number is not live at ${sha:0:7} after 5 minutes (live: ${live:-none})"
    out live false
    ;;

  status)
    sha=$1 state=$2 description=$3 target=${4:-}
    args=(-f state="$state" -f context="$STATUS_CONTEXT" -f description="$description")
    [ -n "$target" ] && args+=(-f target_url="$target")
    gh api -X POST "repos/$REPO/statuses/$sha" "${args[@]}" >/dev/null
    echo "status $state on ${sha:0:7}: $description"
    ;;

  comment-deploying)
    number=$1 sha=$2 run_url=$3
    upsert_comment "$number" "$MARKER
### <img src=\"$SPINNER_URL\" width=\"20\" height=\"20\" alt=\"\"> Preview is deploying…

Building and publishing the preview of ${sha:0:7}. This comment will update with the links when it's ready (usually 2–3 minutes).

[Follow the run]($run_url)"
    ;;

  comment-failed)
    number=$1 sha=$2 run_url=$3
    upsert_comment "$number" "$MARKER
### Preview failed

Publishing the preview of ${sha:0:7} failed. [See the run]($run_url) for details; pushing a new commit retries."
    ;;

  comment-published)
    number=$1 sha=$2 expires=$3
    url=$(preview_url "$number")
    human_expiry=$(date -u -d "$expires" "+%Y-%m-%d %H:%M UTC")
    body=$(cat <<EOF
$MARKER
### Preview of ${sha:0:7}

| | |
|---|---|
| Page | $url |
| PDF | ${url}cv.pdf |
| Social preview image | ${url}images/preview.png |

<a href="${url}images/preview.png"><img src="${url}images/preview.png?v=${sha:0:7}" width="600" alt="Social preview image"></a>

This preview expires on **$human_expiry** (7 days after this build), or as soon as this PR is merged or closed.
EOF
)
    upsert_comment "$number" "$body"
    ;;

  comment-removed)
    read -r -a entries <<<"${1:-}"
    for entry in "${entries[@]}"; do
      number=${entry%%:*} reason=${entry#*:}
      case "$reason" in
        merged) why="this PR was merged" ;;
        closed) why="this PR was closed" ;;
        expired) why="it expired after 7 days. Push a new commit to publish a fresh preview" ;;
        *) why="$reason" ;;
      esac
      upsert_comment "$number" "$MARKER
### Preview removed

The preview for this PR was removed because $why."
    done
    ;;

  comment-skipped)
    number=$1 reason=$2
    case "$reason" in
      untrusted:*)
        upsert_comment "$number" "$MARKER
### Preview not published

Previews are only published for PRs from the repository's owner and collaborators, and \`${reason#untrusted:}\` is neither."
        ;;
      *) echo "not commenting for reason: $reason" ;;
    esac
    ;;

  *)
    echo "unknown command: $cmd" >&2
    exit 1
    ;;
esac
