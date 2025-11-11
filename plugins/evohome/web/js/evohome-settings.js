/**
 * EvoHome Settings JavaScript
 * 
 * Handles the settings/configuration page for EvoHome plugin:
 * - Dynamically generates form from schema
 * - Loads current settings from API
 * - Validates and saves updated settings
 * - Tests API connection with credentials
 * - Password visibility toggle
 */

let configSchema = null;

/**
 * Loads configuration schema from the server and generates the form
 */
async function loadSchema() {
  try {
    configSchema = await fetchConfigSchema();
    generateForm();
    
    // After form is generated, load current settings values
    await loadSettings();
    
  } catch (error) {
    showMessage('Failed to load configuration schema', 'error');
    console.error('Error loading schema:', error);
  }
}

/**
 * Generates form fields from schema
 */
function generateForm() {
  if (!configSchema) return;
  
  const form = document.getElementById('settings-form');
  
  if (!form) {
    console.error('Settings form element not found');
    return;
  }
  
  form.innerHTML = ''; // Clear existing content
  
  // Generate Credentials section
  const credentialsSection = createSection('🔐 Credentials', 'Your Honeywell EvoHome account details', [
    createField('credentials', 'username', configSchema.credentials.username),
    createField('credentials', 'password', configSchema.credentials.password),
  ]);
  form.appendChild(credentialsSection);
  
  // Generate API Settings section
  const apiSection = createSection('🌐 API Configuration', 'EvoHome API settings', [
    createField('settings', 'dhwSetTemp', configSchema.settings.dhwSetTemp),
    createField('settings', 'boostTemp', configSchema.settings.boostTemp),
  ]);
  form.appendChild(apiSection);
  
  // Generate Polling Configuration section
  const pollingSection = createSection(
    '⏱️ Polling Configuration', 
    'Control how often data is fetched from the API. All polling is synchronized to run at aligned times (e.g., every 5 minutes = :00, :05, :10, :15, etc.)',
    [
      createField('polling', 'zoneStatus', configSchema.polling.zoneStatus),
      createField('polling', 'overrideReset', configSchema.polling.overrideReset),
      createField('polling', 'scheduleRefresh', configSchema.polling.scheduleRefresh),
    ]
  );
  form.appendChild(pollingSection);
  
  // Add submit buttons
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'button-group';
  buttonGroup.innerHTML = `
    <button type="submit" class="btn btn-primary">💾 Save Settings</button>
    <button type="button" id="test-connection" class="btn btn-secondary">🔌 Test Connection</button>
    <button type="button" id="cancel-btn" class="btn btn-secondary">❌ Cancel</button>
  `;
  form.appendChild(buttonGroup);
  
  // Add password toggle functionality
  const passwordToggles = form.querySelectorAll('.toggle-password');
  passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      const input = this.previousElementSibling;
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      this.textContent = type === 'password' ? '👁️ Show' : '🙈 Hide';
    });
  });
}

/**
 * Creates a settings section
 */
function createSection(title, description, fields) {
  const section = document.createElement('div');
  section.className = 'settings-section';
  
  const header = document.createElement('h2');
  header.textContent = title;
  section.appendChild(header);
  
  const desc = document.createElement('p');
  desc.className = 'section-description';
  desc.textContent = description;
  section.appendChild(desc);
  
  fields.forEach(field => section.appendChild(field));
  
  return section;
}

/**
 * Creates a form field from schema definition
 */
function createField(section, fieldName, fieldSchema) {
  const formGroup = document.createElement('div');
  formGroup.className = 'form-group';
  
  // Create label
  const label = document.createElement('label');
  label.setAttribute('for', `${section}.${fieldName}`);
  label.textContent = fieldSchema.label + (fieldSchema.unit ? ` (${fieldSchema.unit})` : '');
  formGroup.appendChild(label);
  
  // Create input wrapper for password toggle
  if (fieldSchema.type === 'password') {
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-with-toggle';
    
    const input = createInput(fieldName, fieldSchema, section);
    inputWrapper.appendChild(input);
    
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle-password';
    toggle.textContent = '👁️ Show';
    inputWrapper.appendChild(toggle);
    
    formGroup.appendChild(inputWrapper);
  } else {
    const input = createInput(fieldName, fieldSchema, section);
    formGroup.appendChild(input);
  }
  
  // Create help text with range information
  const small = document.createElement('small');
  let helpText = fieldSchema.description;
  
  // Add range information for number fields
  if (fieldSchema.type === 'number' && fieldSchema.min !== undefined && fieldSchema.max !== undefined) {
    const unit = fieldSchema.unit || '';
    helpText += ` (${fieldSchema.min}-${fieldSchema.max}${unit})`;
  }
  
  small.textContent = helpText;
  formGroup.appendChild(small);
  
  return formGroup;
}

/**
 * Creates an input element from schema definition
 */
function createInput(fieldName, fieldSchema, section) {
  const input = document.createElement('input');
  input.type = fieldSchema.type;
  // Use section.fieldName as ID to match loadSettings() lookup
  input.id = section ? `${section}.${fieldName}` : fieldName;
  input.name = fieldName;
  input.required = fieldSchema.required;
  
  if (fieldSchema.type === 'number') {
    input.min = fieldSchema.min;
    input.max = fieldSchema.max;
    input.step = fieldSchema.step;
  }
  
  if (fieldSchema.placeholder) {
    input.placeholder = fieldSchema.placeholder;
  }
  
  input.value = fieldSchema.defaultValue;
  
  return input;
}

/**
 * Loads current settings values into the form
 */
async function loadSettings() {
  try {
    const config = await fetchEvohomeConfig();
    currentConfig = config;
    
    // Populate form with current values
    Object.keys(config).forEach(section => {
      if (typeof config[section] === 'object' && config[section] !== null) {
        Object.keys(config[section]).forEach(key => {
          const fieldId = `${section}.${key}`;
          const input = document.getElementById(fieldId);
          if (input) {
            input.value = config[section][key];
          }
        });
      }
    });
    
  } catch (error) {
    showMessage('Failed to load current settings', 'error');
    console.error('Error loading settings:', error);
  }
}

/**
 * Handles form submission
 */
async function saveSettings(e) {
  e.preventDefault();
  
  const btn = document.querySelector('button[type="submit"]');
  setButtonLoading(btn.id || 'save-btn', true, '⏳ Saving...');
  
  const formData = new FormData(e.target);
  const updatedSettings = {
    username: formData.get('username'),
    password: formData.get('password'),
    dhwSetTemp: formData.get('dhwSetTemp'),
    boostTemp: formData.get('boostTemp'),
    zoneStatus: formData.get('zoneStatus'),
    overrideReset: formData.get('overrideReset'),
    scheduleRefresh: formData.get('scheduleRefresh'),
  };
  
  try {
    const result = await apiFetch('/plugin/evohome/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings)
    });
    
    if (result.success) {
      showMessage('✅ Settings saved successfully!', 'success');
      
      // Reload page after 2 seconds to apply new settings
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      showMessage(`❌ Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showMessage('❌ Failed to save settings', 'error');
    console.error('Error saving settings:', error);
  } finally {
    setButtonLoading(btn.id || 'save-btn', false);
  }
}

/**
 * Tests the API connection with current form values (without saving)
 */
async function testConnection() {
  const btn = document.getElementById('test-connection');
  setButtonLoading('test-connection', true, '⏳ Testing...');
  
  showMessage('Testing connection to EvoHome API...', 'info');
  
  // Get current form values
  const formData = new FormData(document.getElementById('settings-form'));
  const settings = {
    username: formData.get('username'),
    password: formData.get('password'),
    dhwSetTemp: formData.get('dhwSetTemp'),
    boostTemp: formData.get('boostTemp'),
    zoneStatus: formData.get('zoneStatus'),
    overrideReset: formData.get('overrideReset'),
    scheduleRefresh: formData.get('scheduleRefresh'),
  };
  
  try {
    const result = await apiFetch('/plugin/evohome/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    
    if (result.success) {
      showMessage('✅ Connection successful! Retrieved ' + result.devices.length + ' devices', 'success');
    } else {
      showMessage('❌ Connection failed: ' + (result.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('❌ Connection test failed', 'error');
    console.error('Error testing connection:', error);
  } finally {
    setButtonLoading('test-connection', false);
  }
}

/**
 * Toggles password visibility
 */
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleBtn.textContent = '🙈 Hide';
  } else {
    passwordInput.type = 'password';
    toggleBtn.textContent = '👁️ Show';
  }
}

/**
 * Cancels and returns to dashboard
 */
function cancelSettings() {
  window.location.href = '/plugin/evohome';
}

// ============================================================================
// Event Listeners
// ============================================================================

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Load schema and generate form, then populate with current values
  await loadSchema();
  
  // Attach event listeners after form is generated
  const form = document.getElementById('settings-form');
  if (form) {
    form.addEventListener('submit', saveSettings);
  }
  
  const testBtn = document.getElementById('test-connection');
  if (testBtn) {
    testBtn.addEventListener('click', testConnection);
  }
  
  const cancelBtn = document.getElementById('cancel-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelSettings);
  }
});
