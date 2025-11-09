/**
 * Core Template Helper
 * 
 * Generic utilities for working with HTML templates.
 * Provides template loading, caching, and cloning functionality
 * that can be used by any plugin.
 */

// Cache for loaded templates
const templateCache = new Map();

// Track which template files have been loaded
const loadedTemplateFiles = new Set();

/**
 * Loads templates from an HTML file into the page
 * Call this once per template file before using templates from that file
 * @param {string} templateUrl - URL to the HTML file containing templates
 * @returns {Promise<void>}
 */
async function loadTemplates(templateUrl) {
  if (loadedTemplateFiles.has(templateUrl)) {
    return; // Already loaded
  }
  
  try {
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to load templates from ${templateUrl}: ${response.status}`);
    }
    
    const html = await response.text();
    const container = document.createElement('div');
    container.style.display = 'none';
    container.innerHTML = html;
    document.body.appendChild(container);
    
    loadedTemplateFiles.add(templateUrl);
    console.log(`✅ Templates loaded from ${templateUrl}`);
  } catch (error) {
    console.error(`❌ Failed to load templates from ${templateUrl}:`, error);
    throw error;
  }
}

/**
 * Gets a template by ID and returns a cloned node ready for manipulation
 * @param {string} templateId - Template ID (e.g., 'template-device-row')
 * @returns {DocumentFragment} Cloned template content
 * @throws {Error} If template not found
 */
function getTemplate(templateId) {
  // Check cache first
  if (templateCache.has(templateId)) {
    return templateCache.get(templateId).content.cloneNode(true);
  }
  
  // Get template from DOM
  const template = document.getElementById(templateId);
  if (!template) {
    const loadedFiles = Array.from(loadedTemplateFiles).join(', ');
    console.error(`❌ Template not found: ${templateId}`);
    console.error(`   Loaded template files: ${loadedFiles || 'none'}`);
    console.error(`   Available templates:`, Array.from(document.querySelectorAll('template[id]')).map(t => t.id));
    throw new Error(`Template "${templateId}" not found. Loaded files: ${loadedFiles || 'none'}`);
  }
  
  // Cache for future use
  templateCache.set(templateId, template);
  
  return template.content.cloneNode(true);
}

/**
 * Shows a loading message in a container using a template
 * @param {HTMLElement} container - Container element
 * @param {string} templateId - Loading template ID (default: 'template-loading')
 * @param {string} message - Loading message (optional)
 */
function showLoading(container, templateId = 'template-loading', message = 'Loading...') {
  try {
    const loading = getTemplate(templateId);
    const textElement = loading.querySelector('[data-loading-text]');
    if (textElement && message) {
      textElement.textContent = message;
    }
    container.innerHTML = '';
    container.appendChild(loading);
  } catch (error) {
    // Fallback if template not available
    container.innerHTML = `<div class="loading">${message}</div>`;
  }
}

/**
 * Shows an error message in a container using a template
 * @param {HTMLElement} container - Container element
 * @param {string} templateId - Error template ID (default: 'template-error')
 * @param {string} message - Error message
 */
function showError(container, templateId = 'template-error', message) {
  try {
    const error = getTemplate(templateId);
    const textElement = error.querySelector('[data-error-message]');
    if (textElement) {
      textElement.textContent = message;
    }
    container.innerHTML = '';
    container.appendChild(error);
  } catch (err) {
    // Fallback if template not available
    container.innerHTML = `<div class="error">${message}</div>`;
  }
}

/**
 * Clears the template cache
 * Useful for development/testing or if templates are updated dynamically
 */
function clearTemplateCache() {
  templateCache.clear();
  loadedTemplateFiles.clear();
  console.log('Template cache cleared');
}
