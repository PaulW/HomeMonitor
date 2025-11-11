/**
 * @fileoverview Sidebar Navigation Management
 * Handles active navigation highlighting and collapsible section state persistence
 * 
 * @author Home Monitor Platform
 * @version 1.0.0
 */

/**
 * Sidebar Navigation Controller
 * Manages navigation state, active highlighting, and section collapse/expand
 * 
 * @class
 */
class SidebarNav {
  /**
   * Initialize the sidebar navigation
   */
  constructor() {
    this.currentPath = window.location.pathname;
    this.activeSection = null;
  }

  /**
   * Initialize all sidebar navigation features
   */
  init() {
    this.highlightActiveNav();
    this.restoreSectionStates();
    this.exposeFunctions();
  }

  /**
   * Highlight the active navigation item based on current URL path
   */
  highlightActiveNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-path') === this.currentPath) {
        item.classList.add('active');
        // Find the section containing this active item
        this.activeSection = item.closest('.nav-section');
      }
    });
  }

  /**
   * Restore section collapse/expand states from localStorage
   * Always expands section containing active page
   */
  restoreSectionStates() {
    document.querySelectorAll('.nav-section').forEach(section => {
      const sectionNameElement = section.querySelector('.nav-section-title span:last-child');
      const items = section.querySelector('.nav-section-items');
      const toggle = section.querySelector('.section-toggle');
      
      // Skip if required elements are missing
      if (!sectionNameElement || !items || !toggle) {
        console.warn('Skipping section with missing elements:', section);
        return;
      }
      
      const sectionName = sectionNameElement.textContent;
      
      // If this section contains the active page, always expand it
      if (section === this.activeSection) {
        this.expandSection(items, toggle, sectionName);
      } else {
        // Otherwise restore from localStorage
        const isCollapsed = this.getStorageItem(`section-${sectionName}`) === 'collapsed';
        
        if (!isCollapsed) {
          this.expandSection(items, toggle, sectionName);
        }
      }
    });
  }

  /**
   * Expand a navigation section
   * 
   * @param {HTMLElement} items - The section items container
   * @param {HTMLElement} toggle - The toggle icon element
   * @param {string} sectionName - The name of the section
   */
  expandSection(items, toggle, sectionName) {
    items.classList.remove('collapsed');
    toggle.textContent = '▼';
    this.setStorageItem(`section-${sectionName}`, 'expanded');
  }

  /**
   * Collapse a navigation section
   * 
   * @param {HTMLElement} items - The section items container
   * @param {HTMLElement} toggle - The toggle icon element
   * @param {string} sectionName - The name of the section
   */
  collapseSection(items, toggle, sectionName) {
    items.classList.add('collapsed');
    toggle.textContent = '▶';
    this.setStorageItem(`section-${sectionName}`, 'collapsed');
  }

  /**
   * Toggle a section between collapsed and expanded states
   * Called by onclick handler in layout.html
   * 
   * @param {HTMLElement} element - The section title element that was clicked
   */
  toggleSection(element) {
    const items = element.nextElementSibling;
    const toggle = element.querySelector('.section-toggle');
    const sectionNameElement = element.querySelector('span:last-child');
    
    if (!items || !toggle || !sectionNameElement) {
      console.error('Invalid section structure for toggle:', element);
      return;
    }
    
    const sectionName = sectionNameElement.textContent;
    
    if (items.classList.contains('collapsed')) {
      this.expandSection(items, toggle, sectionName);
    } else {
      this.collapseSection(items, toggle, sectionName);
    }
  }

  /**
   * Safe localStorage getter with error handling
   * 
   * @param {string} key - The localStorage key
   * @returns {string|null} The stored value or null if error/not found
   */
  getStorageItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
      return null;
    }
  }

  /**
   * Safe localStorage setter with error handling
   * 
   * @param {string} key - The localStorage key
   * @param {string} value - The value to store
   */
  setStorageItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  /**
   * Expose necessary functions globally for inline onclick handlers
   * This maintains backward compatibility with existing HTML
   */
  exposeFunctions() {
    window.toggleSection = this.toggleSection.bind(this);
  }
}

/**
 * Initialize sidebar navigation on DOM ready
 */
document.addEventListener('DOMContentLoaded', () => {
  const sidebarNav = new SidebarNav();
  sidebarNav.init();
  
  // Expose globally for debugging
  window.SidebarNav = sidebarNav;
});
