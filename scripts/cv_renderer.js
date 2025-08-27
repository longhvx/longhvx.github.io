/**
 * CV Renderer - Main rendering logic for CV Builder
 * Handles all block types and generates HTML structure
 */

class CVRenderer {
  constructor() {
    this.currentLanguage = "en";
  }

  /**
   * Set current language for rendering
   * @param {string} language - Language code
   */
  setLanguage(language) {
    this.currentLanguage = language;
  }

  /**
   * Generate table of contents from CV data
   * @param {Object} cvData - CV data object
   * @returns {HTMLElement} - Table of contents element
   */
  generateTableOfContents(cvData) {
    if (!cvData || !cvData.blocks) {
      return null;
    }

    const tocContainer = document.createElement("div");
    tocContainer.className = "cv-toc";

    const tocTitle = document.createElement("h3");
    tocTitle.textContent = "Table of Contents";
    tocTitle.className = "toc-title";
    tocContainer.appendChild(tocTitle);

    const tocList = document.createElement("ul");
    tocList.className = "toc-list";

    // Find all sections
    cvData.blocks.forEach((block) => {
      if (block.type === "section" && block.title) {
        const titleText = TextProcessor.getLocalizedText(
          block.title,
          this.currentLanguage
        );
        const sectionId = this.generateId(titleText);

        const tocItem = document.createElement("li");
        tocItem.className = "toc-item";

        const tocLink = document.createElement("a");
        tocLink.href = `#${sectionId}`;
        tocLink.textContent = titleText;
        tocLink.className = "toc-link";

        tocItem.appendChild(tocLink);
        tocList.appendChild(tocItem);
      }
    });

    tocContainer.appendChild(tocList);
    return tocContainer;
  }

  /**
   * Generate a safe ID from text
   * @param {string} text - Text to convert to ID
   * @returns {string} - Safe ID string
   */
  generateId(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  /**
   * Render complete CV from data
   * @param {Object} cvData - CV data object
   * @returns {Object} - Object containing toc and main content elements
   */
  renderCV(cvData) {
    if (!cvData || !cvData.blocks) {
      throw new Error("Invalid CV data structure");
    }

    // Generate table of contents
    const toc = this.generateTableOfContents(cvData);

    // Create main document container
    const cvContainer = document.createElement("div");
    cvContainer.className = "cv-document";

    // Render blocks
    if (Array.isArray(cvData.blocks)) {
      cvData.blocks.forEach((block) => {
        const renderedBlock = this.renderBlock(block);
        if (renderedBlock) {
          cvContainer.appendChild(renderedBlock);
        }
      });
    }

    return {
      toc: toc,
      content: cvContainer
    };
  }

  /**
   * Render individual block based on type
   * @param {Object} block - Block data
   * @returns {HTMLElement|null} - Rendered block element
   */
  renderBlock(block) {
    if (!block || !block.type) {
      return null;
    }

    switch (block.type) {
      case "header":
        return this.renderHeader(block);
      case "heading":
        return this.renderHeading(block);
      case "paragraph":
        return this.renderParagraph(block);
      case "section":
        return this.renderSection(block);
      case "subsection":
        return this.renderSubsection(block);
      case "list":
        return this.renderList(block);
      case "divider":
        return this.renderDivider(block);
      default:
        console.warn(`Unknown block type: ${block.type}`);
        return null;
    }
  }

  /**
   * Render header block
   * @param {Object} block - Header block data
   * @returns {HTMLElement} - Rendered header
   */
  renderHeader(block) {
    const header = document.createElement("div");
    header.className = "cv-header";

    // Render name
    if (block.name) {
      const nameElement = TextProcessor.createElement(
        "h1",
        block.name,
        this.currentLanguage,
        { class: "cv-name" }
      );
      header.appendChild(nameElement);
    }

    // Render title
    if (block.title) {
      const titleElement = TextProcessor.createElement(
        "h2",
        block.title,
        this.currentLanguage,
        { class: "cv-title" }
      );
      header.appendChild(titleElement);
    }

    // Render contact information
    if (block.contact) {
      const contactElement = this.renderContact(block.contact);
      header.appendChild(contactElement);
    }

    return header;
  }

  /**
   * Render contact information
   * @param {Object} contact - Contact data
   * @returns {HTMLElement} - Rendered contact element
   */
  renderContact(contact) {
    const contactDiv = document.createElement("div");
    contactDiv.className = "cv-contact";

    const contactItems = [];

    if (contact.email) {
      const email = TextProcessor.getLocalizedText(
        contact.email,
        this.currentLanguage
      );
      if (email) {
        contactItems.push(`Email: ${email}`);
      }
    }

    if (contact.phone) {
      const phone = TextProcessor.getLocalizedText(
        contact.phone,
        this.currentLanguage
      );
      if (phone) {
        contactItems.push(`Phone: ${phone}`);
      }
    }

    if (contact.location) {
      const location = TextProcessor.getLocalizedText(
        contact.location,
        this.currentLanguage
      );
      if (location) {
        contactItems.push(`Location: ${location}`);
      }
    }

    contactDiv.textContent = contactItems.join(" | ");
    return contactDiv;
  }

  /**
   * Render heading block
   * @param {Object} block - Heading block data
   * @returns {HTMLElement} - Rendered heading
   */
  renderHeading(block) {
    const level = block.level || 1;
    const tagName = `h${level}`;

    let className = "";
    if (level === 1) {
      className = "cv-name";
    } else if (level === 2) {
      className = "cv-title";
    } else if (level === 3) {
      className = "cv-contact";
    }

    const element = TextProcessor.createElement(
      tagName,
      block.text,
      this.currentLanguage,
      { class: className }
    );

    return element;
  }

  /**
   * Render paragraph block
   * @param {Object} block - Paragraph block data
   * @returns {HTMLElement} - Rendered paragraph
   */
  renderParagraph(block) {
    return TextProcessor.createElement("p", block.text, this.currentLanguage, {
      class: "cv-paragraph",
    });
  }

  /**
   * Render section block
   * @param {Object} block - Section block data
   * @returns {HTMLElement} - Rendered section
   */
  renderSection(block) {
    const section = document.createElement("div");
    section.className = "cv-section";

    // Render section title
    if (block.title) {
      const titleText = TextProcessor.getLocalizedText(
        block.title,
        this.currentLanguage
      );
      const sectionId = this.generateId(titleText);

      // Set section ID for hash linking
      section.id = sectionId;

      const titleElement = TextProcessor.createElement(
        "h2",
        block.title,
        this.currentLanguage,
        { class: "section-title" }
      );

      // Add hash link to title
      const hashLink = document.createElement("a");
      hashLink.href = `#${sectionId}`;
      hashLink.className = "section-hash-link";
      hashLink.innerHTML = "#";
      hashLink.title = `Link to ${titleText}`;

      titleElement.appendChild(hashLink);
      section.appendChild(titleElement);
    }

    // Render section blocks
    if (block.blocks && Array.isArray(block.blocks)) {
      block.blocks.forEach((subBlock) => {
        const renderedSubBlock = this.renderBlock(subBlock);
        if (renderedSubBlock) {
          section.appendChild(renderedSubBlock);
        }
      });
    }

    return section;
  }

  /**
   * Render subsection block
   * @param {Object} block - Subsection block data
   * @returns {HTMLElement} - Rendered subsection
   */
  renderSubsection(block) {
    const subsection = document.createElement("div");
    subsection.className = "cv-subsection";

    // Render subsection title
    if (block.title) {
      const titleElement = TextProcessor.createElement(
        "h3",
        block.title,
        this.currentLanguage,
        { class: "subsection-title" }
      );
      subsection.appendChild(titleElement);
    }

    // Render subsection blocks
    if (block.blocks && Array.isArray(block.blocks)) {
      block.blocks.forEach((subBlock) => {
        const renderedSubBlock = this.renderBlock(subBlock);
        if (renderedSubBlock) {
          subsection.appendChild(renderedSubBlock);
        }
      });
    }

    return subsection;
  }

  /**
   * Render list block
   * @param {Object} block - List block data
   * @returns {HTMLElement} - Rendered list
   */
  renderList(block) {
    const listContainer = document.createElement("div");
    listContainer.className = "cv-list";

    // Render list title if present
    if (block.title) {
      const titleElement = TextProcessor.createElement(
        "div",
        block.title,
        this.currentLanguage,
        { class: "list-title" }
      );
      listContainer.appendChild(titleElement);
    }

    // Render list items
    if (block.items && Array.isArray(block.items)) {
      const listElement = document.createElement("ul");

      block.items.forEach((item) => {
        const listItem = TextProcessor.createElement(
          "li",
          item,
          this.currentLanguage
        );
        listElement.appendChild(listItem);
      });

      listContainer.appendChild(listElement);
    }

    return listContainer;
  }

  /**
   * Render divider block
   * @param {Object} block - Divider block data
   * @returns {HTMLElement} - Rendered divider
   */
  renderDivider(block) {
    const divider = document.createElement("div");
    divider.className = "cv-divider";
    return divider;
  }

  /**
   * Update CV content with new language
   * @param {Object} cvData - CV data
   * @param {HTMLElement} container - Container to update
   */
  updateLanguage(cvData, container) {
    if (!container) return;

    // Clear existing content
    container.innerHTML = "";

    // Re-render with new language
    const newContent = this.renderCV(cvData);
    container.appendChild(newContent);
  }

  /**
   * Validate CV data structure
   * @param {Object} cvData - CV data to validate
   * @returns {boolean} - True if valid
   */
  validateCVData(cvData) {
    if (!cvData) return false;
    if (!cvData.blocks || !Array.isArray(cvData.blocks)) return false;

    return true;
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = CVRenderer;
}
