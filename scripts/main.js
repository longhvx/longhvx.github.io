/**
 * Main Application Script for CV Builder
 * Handles initialization, data loading, and user interactions
 */

class CVBuilder {
  constructor() {
    this.cvData = null;
    this.renderer = new CVRenderer();
    this.currentLanguage = "en";

    // DOM elements
    this.cvContent = document.getElementById("cv-content");
    this.languageSelect = document.getElementById("language-select");
    this.downloadPdfBtn = document.getElementById("download-pdf-btn");

    this.initialize();
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      // Load CV data
      await this.loadCVData();

      // Set up event listeners
      this.setupEventListeners();

      // Render initial CV
      this.renderCV();
    } catch (error) {
      console.error("Failed to initialize CV Builder:", error);
      this.showError(
        "Failed to load CV data. Please check the data.json file."
      );
    }
  }

  /**
   * Load CV data from JSON file
   */
  async loadCVData() {
    try {
      const response = await fetch("data.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.cvData = await response.json();

      // Validate data structure
      if (!this.renderer.validateCVData(this.cvData)) {
        throw new Error("Invalid CV data structure");
      }

      // Update language options if available
      this.updateLanguageOptions();
    } catch (error) {
      console.error("Error loading CV data:", error);
      throw error;
    }
  }

  /**
   * Update language selector options
   */
  updateLanguageOptions() {
    // For now, just set English as default since the new structure only has English
    if (this.languageSelect) {
      this.languageSelect.innerHTML = '<option value="en">English</option>';
      this.languageSelect.value = this.currentLanguage;
    }
  }

  /**
   * Get display name for language code
   * @param {string} langCode - Language code
   * @returns {string} - Display name
   */
  getLanguageDisplayName(langCode) {
    const languageNames = {
      en: "English",
      vi: "Vietnamese",
      fr: "French",
      es: "Spanish",
      de: "German",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
    };

    return languageNames[langCode] || langCode.toUpperCase();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Language change
    if (this.languageSelect) {
      this.languageSelect.addEventListener("change", (e) => {
        this.changeLanguage(e.target.value);
      });
    }

    // Download PDF button
    if (this.downloadPdfBtn) {
      this.downloadPdfBtn.addEventListener("click", () => {
        this.downloadPDF();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Ctrl/Cmd + P for print (still works for browser print)
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        // Let browser handle print dialog
      }
    });
  }

  /**
   * Change language and re-render CV
   * @param {string} language - New language code
   */
  changeLanguage(language) {
    if (language === this.currentLanguage) {
      return;
    }

    this.currentLanguage = language;
    this.renderer.setLanguage(language);

    // Re-render CV with new language
    this.renderCV();

    // Save language preference
    this.saveLanguagePreference(language);
  }

  /**
   * Render CV content
   */
  renderCV() {
    if (!this.cvData || !this.cvContent) {
      return;
    }

    try {
      // Clear loading state
      this.cvContent.innerHTML = "";

      // Render CV with separate TOC and content
      const renderedCV = this.renderer.renderCV(this.cvData);
      
      // Add table of contents if available
      if (renderedCV.toc) {
        this.cvContent.appendChild(renderedCV.toc);
      }
      
      // Add main content
      this.cvContent.appendChild(renderedCV.content);
    } catch (error) {
      console.error("Error rendering CV:", error);
      this.showError("Failed to render CV. Please check the data structure.");
    }
  }

  /**
   * Download CV as PDF
   */
  downloadPDF() {
    try {
      // Create a link element to download the PDF file
      const link = document.createElement("a");
      link.href = "docs/CV_VuHoangLong_FullStack.pdf";
      link.download = "CV_VuHoangLong_FullStack.pdf";
      link.target = "_blank";

      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading PDF:", error);
      this.showError("Failed to download PDF. Please try printing instead.");
    }
  }

  /**
   * Update page title based on CV data
   */
  updatePageTitle() {
    // Extract name from header block for page title
    if (this.cvData && this.cvData.blocks) {
      const headerBlock = this.cvData.blocks.find(
        (block) => block.type === "header"
      );
      if (headerBlock && headerBlock.name) {
        const name = TextProcessor.getLocalizedText(
          headerBlock.name,
          this.currentLanguage
        );
        if (name) {
          // Remove formatting tags for clean title
          const cleanName = name.replace(/<[^>]*>/g, "");
          document.title = `${cleanName} - CV`;
        }
      }
    }
  }

  /**
   * Save language preference to localStorage
   * @param {string} language - Language code
   */
  saveLanguagePreference(language) {
    try {
      localStorage.setItem("cv-builder-language", language);
    } catch (error) {
      console.warn("Failed to save language preference:", error);
    }
  }

  /**
   * Load language preference from localStorage
   * @returns {string} - Language code
   */
  loadLanguagePreference() {
    try {
      return localStorage.getItem("cv-builder-language") || "en";
    } catch (error) {
      console.warn("Failed to load language preference:", error);
      return "en";
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    if (!this.cvContent) {
      return;
    }

    this.cvContent.innerHTML = `
            <div class="error-message" style="
                text-align: center;
                padding: 2rem;
                color: #e74c3c;
                background-color: #fdf2f2;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                margin: 1rem 0;
            ">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" style="
                    margin-top: 1rem;
                    padding: 0.5rem 1rem;
                    background-color: #e74c3c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Reload Page</button>
            </div>
        `;
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (this.cvContent) {
      this.cvContent.innerHTML = `
                <div class="loading" style="
                    text-align: center;
                    padding: 2rem;
                    color: #7f8c8d;
                    font-style: italic;
                ">
                    Loading CV...
                </div>
            `;
    }
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new CVBuilder();
});

// Export for testing or external use
if (typeof module !== "undefined" && module.exports) {
  module.exports = CVBuilder;
}
