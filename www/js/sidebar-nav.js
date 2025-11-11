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
      const sectionName = section.querySelector('.nav-section-title span:last-child').textContent;
      const items = section.querySelector('.nav-section-items');
      const toggle = section.querySelector('.section-toggle');
      
      // If this section contains the active page, always expand it
      if (section === this.activeSection) {
        this.expandSection(items, toggle, sectionName);
      } else {
        // Otherwise restore from localStorage
        const isCollapsed = localStorage.getItem(`section-${sectionName}`) === 'collapsed';
        
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
    localStorage.setItem(`section-${sectionName}`, 'expanded');
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
    localStorage.setItem(`section-${sectionName}`, 'collapsed');
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
    const sectionName = element.querySelector('span:last-child').textContent;
    
    if (items.classList.contains('collapsed')) {
      this.expandSection(items, toggle, sectionName);
    } else {
      this.collapseSection(items, toggle, sectionName);
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
