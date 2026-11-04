/**
 * Text Processing Utilities for CV Builder
 * Handles custom formatting syntax and multi-language support
 */

class TextProcessor {
  /**
   * Process text with custom formatting syntax
   * @param {string} text - Raw text with formatting
   * @returns {string} - HTML formatted text
   */
  static processText(text) {
    if (!text || typeof text !== "string") {
      return "";
    }

    let processedText = text;

    // Process bold formatting: {{bold('text')}}
    processedText = processedText.replace(
      /\{\{bold\('([^']+)'\)\}\}/g,
      "<strong>$1</strong>"
    );

    // Process underline formatting: {{underline('text')}}
    processedText = processedText.replace(
      /\{\{underline\('([^']+)'\)\}\}/g,
      "<u>$1</u>"
    );

    return processedText;
  }

  /**
   * Get localized text based on language
   * @param {Object} localizedText - Object with language keys
   * @param {string} language - Target language code
   * @returns {string} - Localized text
   */
  static getLocalizedText(localizedText, language = "en") {
    if (!localizedText) {
      return "";
    }

    // If it's already a string, return as is
    if (typeof localizedText === "string") {
      return localizedText;
    }

    // If it's an object with language keys
    if (typeof localizedText === "object") {
      // Try to get text for the specified language
      if (localizedText[language]) {
        return localizedText[language];
      }

      // Fallback to first available language
      const availableLanguages = Object.keys(localizedText);
      if (availableLanguages.length > 0) {
        return localizedText[availableLanguages[0]];
      }
    }

    return "";
  }

  /**
   * Process localized text with formatting
   * @param {Object|string} localizedText - Text object or string
   * @param {string} language - Target language
   * @returns {string} - Processed and formatted text
   */
  static processLocalizedText(localizedText, language = "en") {
    const text = this.getLocalizedText(localizedText, language);
    return this.processText(text);
  }

  /**
   * Sanitize HTML to prevent XSS
   * @param {string} html - HTML string to sanitize
   * @returns {string} - Sanitized HTML
   */
  static sanitizeHtml(html) {
    const div = document.createElement("div");
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Create HTML element with processed text
   * @param {string} tagName - HTML tag name
   * @param {Object|string} localizedText - Text to process
   * @param {string} language - Target language
   * @param {Object} attributes - HTML attributes
   * @returns {HTMLElement} - Created HTML element
   */
  static createElement(
    tagName,
    localizedText,
    language = "en",
    attributes = {}
  ) {
    const element = document.createElement(tagName);
    const processedText = this.processLocalizedText(localizedText, language);
    element.innerHTML = processedText;

    // Add attributes
    Object.keys(attributes).forEach((key) => {
      element.setAttribute(key, attributes[key]);
    });

    return element;
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = TextProcessor;
}
