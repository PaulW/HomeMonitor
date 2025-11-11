/**
 * DOM Differ Utility
 * 
 * Core framework utility for efficient, differential DOM updates.
 * Implements a lightweight virtual DOM-like diffing algorithm without frameworks.
 * 
 * Features:
 * - Incremental updates (only changed elements are touched)
 * - Preserves element identity and state (buttons, inputs, focus)
 * - Data-driven updates using data attributes
 * - Works with any plugin without plugin-specific code
 * - No dependencies, pure vanilla JS
 * 
 * Usage:
 *   const differ = new DOMDiffer(containerElement);
 *   differ.updateCollection(items, createItemFn, updateItemFn, itemIdFn);
 * 
 * @module dom-differ
 */

/**
 * DOMDiffer - Manages differential updates for a collection of DOM elements
 * 
 * @class
 * @example
 * const differ = new DOMDiffer(document.getElementById('room-grid'));
 * 
 * differ.updateCollection(
 *   rooms,                              // Array of data items
 *   (room) => createRoomCard(room),     // Function to create new element
 *   (element, room) => updateRoom(element, room), // Function to update existing
 *   (room) => room.id                   // Function to get unique ID
 * );
 */
class DOMDiffer {
  /**
   * Creates a new DOMDiffer instance
   * 
   * @param {HTMLElement} container - Container element that holds the collection
   * @param {Object} options - Configuration options
   * @param {string} options.idAttribute - Data attribute name for element IDs (default: 'data-item-id')
   * @param {Function} options.shouldUpdate - Custom comparison function (item, prevItem) => boolean
   */
  constructor(container, options = {}) {
    this.container = container;
    this.idAttribute = options.idAttribute || 'data-item-id';
    this.shouldUpdate = options.shouldUpdate || this.defaultShouldUpdate;
    this.previousItems = new Map();
  }

  /**
   * Updates a collection of elements in the container
   * 
   * @param {Array} items - Array of data items to render
   * @param {Function} createElement - Function to create new DOM element: (item) => HTMLElement
   * @param {Function} updateElement - Function to update existing element: (element, item, prevItem) => void
   * @param {Function} getItemId - Function to extract unique ID: (item) => string|number
   */
  updateCollection(items, createElement, updateElement, getItemId) {
    if (!items || !Array.isArray(items)) {
      this.container.innerHTML = '';
      this.previousItems.clear();
      return;
    }

    const currentItemIds = new Set(items.map(getItemId));
    
    // Remove elements that no longer exist in data
    this.removeStaleElements(currentItemIds);
    
    // Update or create elements for each item
    items.forEach((item, index) => {
      const itemId = getItemId(item);
      let element = this.getElement(itemId);
      
      if (!element) {
        // Create new element
        element = createElement(item);
        element.setAttribute(this.idAttribute, itemId);
        this.insertElementAtIndex(element, index);
        this.previousItems.set(itemId, this.cloneItemData(item));
      } else {
        // Check if position changed
        const children = Array.from(this.container.children);
        const currentIndex = children.indexOf(element);
        const positionChanged = currentIndex !== index;
        
        // Update existing element if data changed
        const prevItem = this.previousItems.get(itemId);
        const dataChanged = this.shouldUpdate(item, prevItem);
        
        if (dataChanged) {
          updateElement(element, item, prevItem);
          this.previousItems.set(itemId, this.cloneItemData(item));
        }
        
        // Only move element if position actually changed
        if (positionChanged) {
          this.ensureElementPosition(element, index);
        }
      }
    });
  }

  /**
   * Updates a single property across all elements
   * Useful for bulk updates of one field (e.g., status badge on all cards)
   * 
   * @param {Function} selector - Function to select target element within each item: (element) => HTMLElement
   * @param {Function} updater - Function to update the selected element: (element, itemId) => void
   */
  updateProperty(selector, updater) {
    const elements = this.container.querySelectorAll(`[${this.idAttribute}]`);
    elements.forEach(element => {
      const itemId = element.getAttribute(this.idAttribute);
      const targetElement = selector(element);
      if (targetElement) {
        updater(targetElement, itemId);
      }
    });
  }

  /**
   * Updates a single element by ID
   * 
   * @param {string|number} itemId - Unique identifier for the item
   * @param {Function} updateFn - Function to update the element: (element) => void
   */
  updateOne(itemId, updateFn) {
    const element = this.getElement(itemId);
    if (element) {
      updateFn(element);
    }
  }

  /**
   * Removes all elements and clears cache
   */
  clear() {
    this.container.innerHTML = '';
    this.previousItems.clear();
  }

  /**
   * Gets element by item ID
   * @private
   */
  getElement(itemId) {
    // Convert itemId to string for attribute comparison (setAttribute always converts to string)
    return this.container.querySelector(`[${this.idAttribute}="${String(itemId)}"]`);
  }

  /**
   * Removes elements that are no longer in the data
   * @private
   */
  removeStaleElements(currentItemIds) {
    const elements = this.container.querySelectorAll(`[${this.idAttribute}]`);
    elements.forEach(element => {
      const itemId = element.getAttribute(this.idAttribute);
      // Convert both to strings for comparison (Map keys might be numbers, attributes are always strings)
      const itemIdStr = String(itemId);
      const hasMatch = Array.from(currentItemIds).some(id => String(id) === itemIdStr);
      if (!hasMatch) {
        element.remove();
        this.previousItems.delete(itemId);
      }
    });
  }

  /**
   * Inserts element at specific index position
   * @private
   */
  insertElementAtIndex(element, index) {
    const children = Array.from(this.container.children);
    if (index >= children.length) {
      this.container.appendChild(element);
    } else {
      this.container.insertBefore(element, children[index]);
    }
  }

  /**
   * Ensures element is at correct position in DOM
   * Only moves if necessary to avoid unnecessary reflows
   * @private
   */
  ensureElementPosition(element, targetIndex) {
    const children = Array.from(this.container.children);
    const currentIndex = children.indexOf(element);
    
    // Only move if position is actually different
    if (currentIndex !== targetIndex) {
      if (targetIndex >= children.length) {
        this.container.appendChild(element);
      } else {
        this.container.insertBefore(element, children[targetIndex]);
      }
    }
  }

  /**
   * Default comparison function - shallow comparison
   * @private
   */
  defaultShouldUpdate(item, prevItem) {
    // Defensive checks for null/undefined items
    if (!item) return false;
    if (!prevItem) return true;
    
    // Shallow comparison of properties
    const itemKeys = Object.keys(item);
    for (const key of itemKeys) {
      if (item[key] !== prevItem[key]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Deep clone item data for comparison
   * @private
   */
  cloneItemData(item) {
    // For performance, only clone primitive values, not nested objects
    // This prevents false positives when comparing object references
    const clone = {};
    for (const key in item) {
      if (item.hasOwnProperty(key)) {
        const value = item[key];
        // Only clone primitive values and arrays of primitives
        if (value === null || value === undefined ||
            typeof value === 'string' || typeof value === 'number' ||
            typeof value === 'boolean') {
          clone[key] = value;
        }
      }
    }
    return clone;
  }
}

/**
 * ElementUpdater - Utility for updating specific elements within a component
 * 
 * Provides helpers for common update patterns like text, attributes, classes, styles.
 * 
 * @example
 * const updater = new ElementUpdater(cardElement);
 * updater.setText('[data-update="temp"]', '20.5');
 * updater.setClass('[data-update="status"]', 'status-online');
 * updater.setDisplay('[data-update="badge"]', false);
 */
class ElementUpdater {
  /**
   * Creates a new ElementUpdater
   * 
   * @param {HTMLElement} root - Root element to search within
   */
  constructor(root) {
    this.root = root;
  }

  /**
   * Updates text content if changed (prevents unnecessary reflows)
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} newText - New text content
   * @returns {boolean} True if updated
   */
  setText(selector, newText) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    if (element.textContent !== newText) {
      element.textContent = newText;
      return true;
    }
    return false;
  }

  /**
   * Updates HTML content if changed
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} newHTML - New HTML content
   * @returns {boolean} True if updated
   */
  setHTML(selector, newHTML) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    if (element.innerHTML !== newHTML) {
      element.innerHTML = newHTML;
      return true;
    }
    return false;
  }

  /**
   * Updates class name if changed
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} newClassName - New class name
   * @returns {boolean} True if updated
   */
  setClass(selector, newClassName) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    if (element.className !== newClassName) {
      element.className = newClassName;
      return true;
    }
    return false;
  }

  /**
   * Adds or removes a class
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} className - Class name to toggle
   * @param {boolean} shouldHave - True to add, false to remove
   * @returns {boolean} True if changed
   */
  toggleClass(selector, className, shouldHave) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    const hasClass = element.classList.contains(className);
    if (shouldHave && !hasClass) {
      element.classList.add(className);
      return true;
    } else if (!shouldHave && hasClass) {
      element.classList.remove(className);
      return true;
    }
    return false;
  }

  /**
   * Updates an attribute if changed
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} attrName - Attribute name
   * @param {string} newValue - New attribute value
   * @returns {boolean} True if updated
   */
  setAttribute(selector, attrName, newValue) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    if (element.getAttribute(attrName) !== newValue) {
      element.setAttribute(attrName, newValue);
      return true;
    }
    return false;
  }

  /**
   * Updates element display (show/hide)
   * 
   * @param {string} selector - CSS selector for target element
   * @param {boolean} visible - True to show, false to hide
   * @param {string} displayValue - Display value when visible (default: '')
   * @returns {boolean} True if changed
   */
  setDisplay(selector, visible, displayValue = '') {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    const currentDisplay = element.style.display;
    const targetDisplay = visible ? displayValue : 'none';
    
    if (currentDisplay !== targetDisplay) {
      element.style.display = targetDisplay;
      return true;
    }
    return false;
  }

  /**
   * Updates a style property
   * 
   * @param {string} selector - CSS selector for target element
   * @param {string} property - Style property name
   * @param {string} value - New style value
   * @returns {boolean} True if updated
   */
  setStyle(selector, property, value) {
    const element = this.root.querySelector(selector);
    if (!element) return false;
    
    if (element.style[property] !== value) {
      element.style[property] = value;
      return true;
    }
    return false;
  }

  /**
   * Batch update multiple text elements
   * 
   * @param {Object} updates - Map of selector to text value
   * @returns {number} Count of elements updated
   */
  batchSetText(updates) {
    let count = 0;
    for (const [selector, text] of Object.entries(updates)) {
      if (this.setText(selector, text)) count++;
    }
    return count;
  }

  /**
   * Gets element by selector
   * 
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null}
   */
  get(selector) {
    return this.root.querySelector(selector);
  }

  /**
   * Gets all elements by selector
   * 
   * @param {string} selector - CSS selector
   * @returns {NodeList}
   */
  getAll(selector) {
    return this.root.querySelectorAll(selector);
  }
}

/**
 * Creates a debounced version of an update function
 * Useful for limiting update frequency on high-frequency data changes
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounceUpdate(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a throttled version of an update function
 * Ensures function is called at most once per time period
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limit - Milliseconds between calls
 * @returns {Function} Throttled function
 */
function throttleUpdate(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DOMDiffer, ElementUpdater, debounceUpdate, throttleUpdate };
}
