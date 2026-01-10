// UI Tester - Renderer Script
document.addEventListener('DOMContentLoaded', () => {
  // State
  let selectedFolder = null;
  let documents = [];
  let initialSteps = [];      // Run once at the start
  let perUploadSteps = [];    // Run before each file upload
  let currentStepType = null; // Track which step type we're adding/editing
  let editingStepIndex = null; // Track which step is being edited (null = adding new)
  let isRunning = false;

  // DOM Elements
  const elements = {
    // Config
    targetUrl: document.getElementById('targetUrl'),
    uploadSelector: document.getElementById('uploadSelector'),
    submitSelector: document.getElementById('submitSelector'),
    waitAfterUpload: document.getElementById('waitAfterUpload'),
    waitAfterSubmit: document.getElementById('waitAfterSubmit'),
    headless: document.getElementById('headless'),
    
    // Folder
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    folderPath: document.getElementById('folderPath'),
    documentsContainer: document.getElementById('documentsContainer'),
    documentsList: document.getElementById('documentsList'),
    docCount: document.getElementById('docCount'),
    filterJson: document.getElementById('filterJson'),
    filterCsv: document.getElementById('filterCsv'),
    
    // Steps
    initialStepsContainer: document.getElementById('initialSteps'),
    perUploadStepsContainer: document.getElementById('perUploadSteps'),
    addInitialStepBtn: document.getElementById('addInitialStepBtn'),
    addPerUploadStepBtn: document.getElementById('addPerUploadStepBtn'),
    
    // Step Modal
    stepModal: document.getElementById('stepModal'),
    closeStepBtn: document.getElementById('closeStepBtn'),
    stepAction: document.getElementById('stepAction'),
    stepSelector: document.getElementById('stepSelector'),
    stepSelectorGroup: document.getElementById('stepSelectorGroup'),
    stepValue: document.getElementById('stepValue'),
    stepValueGroup: document.getElementById('stepValueGroup'),
    stepDuration: document.getElementById('stepDuration'),
    stepDurationGroup: document.getElementById('stepDurationGroup'),
    stepUrl: document.getElementById('stepUrl'),
    stepUrlGroup: document.getElementById('stepUrlGroup'),
    stepKey: document.getElementById('stepKey'),
    stepKeyGroup: document.getElementById('stepKeyGroup'),
    stepDescription: document.getElementById('stepDescription'),
    stepModalTitle: document.getElementById('stepModalTitle'),
    stepValidationError: document.getElementById('stepValidationError'),
    saveStepBtn: document.getElementById('saveStepBtn'),
    
    // Control
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    progressContainer: document.getElementById('progressContainer'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    currentFile: document.getElementById('currentFile'),
    
    // Logs
    logsContainer: document.getElementById('logsContainer'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    
    // Preview Modal
    previewModal: document.getElementById('previewModal'),
    previewTitle: document.getElementById('previewTitle'),
    previewContent: document.getElementById('previewContent'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    
    // Save/Load Config
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    loadConfigBtn: document.getElementById('loadConfigBtn')
  };

  // Initialize event listeners
  function init() {
    // Folder selection
    elements.selectFolderBtn.addEventListener('click', handleFolderSelect);
    
    // Filters
    elements.filterJson.addEventListener('change', renderDocuments);
    elements.filterCsv.addEventListener('change', renderDocuments);
    
    // Steps - Initial
    elements.addInitialStepBtn.addEventListener('click', () => showStepModal('initial'));
    // Steps - Per Upload
    elements.addPerUploadStepBtn.addEventListener('click', () => showStepModal('perUpload'));
    
    elements.closeStepBtn.addEventListener('click', () => hideModal(elements.stepModal));
    elements.stepAction.addEventListener('change', updateStepModalFields);
    elements.saveStepBtn.addEventListener('click', saveStep);
    
    // Clear validation error when user types in step modal inputs
    elements.stepSelector.addEventListener('input', hideStepValidationError);
    elements.stepValue.addEventListener('input', hideStepValidationError);
    elements.stepUrl.addEventListener('input', hideStepValidationError);
    elements.stepKey.addEventListener('input', hideStepValidationError);
    
    // Control
    elements.startBtn.addEventListener('click', startAutomation);
    elements.stopBtn.addEventListener('click', stopAutomation);
    
    // Logs
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    
    // Preview Modal
    elements.closePreviewBtn.addEventListener('click', () => hideModal(elements.previewModal));
    
    // Save/Load Config
    elements.saveConfigBtn.addEventListener('click', handleSaveConfig);
    elements.loadConfigBtn.addEventListener('click', handleLoadConfig);
    
    // Close modals on background click
    elements.stepModal.addEventListener('click', (e) => {
      if (e.target === elements.stepModal) hideModal(elements.stepModal);
    });
    elements.previewModal.addEventListener('click', (e) => {
      if (e.target === elements.previewModal) hideModal(elements.previewModal);
    });
    
    // Set up IPC listeners
    window.electronAPI.onProgress(handleProgress);
    window.electronAPI.onLog(handleLog);
    
    // Load saved config if any
    loadConfig();
  }

  // Folder Selection
  async function handleFolderSelect() {
    const result = await window.electronAPI.selectFolder();
    
    if (result.success) {
      selectedFolder = result.path;
      elements.folderPath.textContent = selectedFolder;
      
      // Scan for documents
      const scanResult = await window.electronAPI.scanFolder(selectedFolder);
      
      if (scanResult.success) {
        documents = scanResult.documents;
        renderDocuments();
        elements.documentsContainer.classList.remove('hidden');
        updateStartButton();
      } else {
        addLog(`Error scanning folder: ${scanResult.error}`, 'error');
      }
    }
  }

  // Render Documents List
  function renderDocuments() {
    const showJson = elements.filterJson.checked;
    const showCsv = elements.filterCsv.checked;
    
    const filtered = documents.filter(doc => {
      if (doc.extension === '.json' && showJson) return true;
      if (doc.extension === '.csv' && showCsv) return true;
      return false;
    });
    
    elements.docCount.textContent = filtered.length;
    
    if (filtered.length === 0) {
      elements.documentsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          No documents found matching the filters
        </div>
      `;
      return;
    }
    
    elements.documentsList.innerHTML = filtered.map((doc, index) => `
      <div class="document-item" data-index="${index}">
        <input type="checkbox" class="doc-checkbox" data-path="${doc.path}" checked />
        <div class="document-info">
          <span class="document-name">${doc.name}</span>
          <span class="document-ext ${doc.extension.slice(1)}">${doc.extension.slice(1)}</span>
          <span class="document-size">${formatFileSize(doc.size)}</span>
        </div>
        <button class="document-preview-btn" data-path="${doc.path}" data-name="${doc.name}">
          Preview
        </button>
      </div>
    `).join('');
    
    // Add preview button listeners
    elements.documentsList.querySelectorAll('.document-preview-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const path = e.target.dataset.path;
        const name = e.target.dataset.name;
        await showFilePreview(path, name);
      });
    });
    
    // Add checkbox listeners
    elements.documentsList.querySelectorAll('.doc-checkbox').forEach(cb => {
      cb.addEventListener('change', updateStartButton);
    });
    
    updateStartButton();
  }

  // File Size Formatter
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Show File Preview
  async function showFilePreview(filePath, fileName) {
    const result = await window.electronAPI.previewFile(filePath);
    
    if (result.success) {
      elements.previewTitle.textContent = fileName;
      
      // Format JSON nicely
      if (result.extension === '.json') {
        try {
          const parsed = JSON.parse(result.content);
          elements.previewContent.textContent = JSON.stringify(parsed, null, 2);
        } catch {
          elements.previewContent.textContent = result.content;
        }
      } else {
        elements.previewContent.textContent = result.content;
      }
      
      elements.previewModal.classList.remove('hidden');
    } else {
      addLog(`Error previewing file: ${result.error}`, 'error');
    }
  }

  // Custom Steps
  function showStepModal(stepType, editIndex = null) {
    currentStepType = stepType;
    editingStepIndex = editIndex;
    
    const isEditing = editIndex !== null;
    const steps = stepType === 'initial' ? initialSteps : perUploadSteps;
    const stepToEdit = isEditing ? steps[editIndex] : null;
    
    // Update modal title based on step type and mode
    if (elements.stepModalTitle) {
      if (isEditing) {
        elements.stepModalTitle.textContent = stepType === 'initial' 
          ? 'Edit Initial Step' 
          : 'Edit Per-Upload Step';
      } else {
        elements.stepModalTitle.textContent = stepType === 'initial' 
          ? 'Add Initial Step (Run Once)' 
          : 'Add Per-Upload Step (Run for Each File)';
      }
    }
    
    // Update save button text
    elements.saveStepBtn.textContent = isEditing ? 'Save Changes' : 'Add Step';
    
    // Reset or populate form
    if (isEditing && stepToEdit) {
      elements.stepAction.value = stepToEdit.action || 'click';
      elements.stepSelector.value = stepToEdit.selector || '';
      elements.stepValue.value = stepToEdit.value || '';
      elements.stepDuration.value = stepToEdit.duration || '1000';
      elements.stepUrl.value = stepToEdit.url || '';
      elements.stepKey.value = stepToEdit.key || '';
      elements.stepDescription.value = stepToEdit.description || '';
    } else {
      elements.stepAction.value = 'click';
      elements.stepSelector.value = '';
      elements.stepValue.value = '';
      elements.stepDuration.value = '1000';
      elements.stepUrl.value = '';
      elements.stepKey.value = '';
      elements.stepDescription.value = '';
    }
    
    updateStepModalFields();
    hideStepValidationError(); // Clear any previous validation errors
    elements.stepModal.classList.remove('hidden');
  }

  function updateStepModalFields() {
    const action = elements.stepAction.value;
    
    // Hide all optional fields first
    elements.stepSelectorGroup.classList.add('hidden');
    elements.stepValueGroup.classList.add('hidden');
    elements.stepDurationGroup.classList.add('hidden');
    elements.stepUrlGroup.classList.add('hidden');
    elements.stepKeyGroup.classList.add('hidden');
    
    // Show relevant fields based on action
    switch (action) {
      case 'click':
      case 'waitForSelector':
        elements.stepSelectorGroup.classList.remove('hidden');
        break;
      case 'fill':
      case 'type':
        elements.stepSelectorGroup.classList.remove('hidden');
        elements.stepValueGroup.classList.remove('hidden');
        break;
      case 'wait':
        elements.stepDurationGroup.classList.remove('hidden');
        break;
      case 'navigate':
        elements.stepUrlGroup.classList.remove('hidden');
        break;
      case 'press':
        elements.stepKeyGroup.classList.remove('hidden');
        break;
    }
  }

  function saveStep() {
    const action = elements.stepAction.value;
    const step = {
      action,
      description: elements.stepDescription.value || getDefaultDescription(action)
    };
    
    // Add relevant properties based on action
    switch (action) {
      case 'click':
      case 'waitForSelector':
        step.selector = elements.stepSelector.value;
        if (!step.selector) {
          showStepValidationError('Please enter a selector');
          elements.stepSelector.focus();
          return;
        }
        break;
      case 'fill':
      case 'type':
        step.selector = elements.stepSelector.value;
        step.value = elements.stepValue.value;
        if (!step.selector) {
          showStepValidationError('Please enter a selector');
          elements.stepSelector.focus();
          return;
        }
        break;
      case 'wait':
        step.duration = parseInt(elements.stepDuration.value) || 1000;
        break;
      case 'navigate':
        step.url = elements.stepUrl.value;
        if (!step.url) {
          showStepValidationError('Please enter a URL');
          elements.stepUrl.focus();
          return;
        }
        break;
      case 'press':
        step.key = elements.stepKey.value;
        if (!step.key) {
          showStepValidationError('Please enter a key');
          elements.stepKey.focus();
          return;
        }
        break;
    }
    
    // Add or update the step based on whether we're editing
    if (editingStepIndex !== null) {
      // Editing existing step
      if (currentStepType === 'initial') {
        initialSteps[editingStepIndex] = step;
        renderSteps('initial');
      } else {
        perUploadSteps[editingStepIndex] = step;
        renderSteps('perUpload');
      }
    } else {
      // Adding new step
      if (currentStepType === 'initial') {
        initialSteps.push(step);
        renderSteps('initial');
      } else {
        perUploadSteps.push(step);
        renderSteps('perUpload');
      }
    }
    
    editingStepIndex = null; // Reset editing state
    hideModal(elements.stepModal);
  }

  function getDefaultDescription(action) {
    const descriptions = {
      click: 'Click element',
      fill: 'Fill input field',
      type: 'Type text',
      wait: 'Wait',
      waitForSelector: 'Wait for element',
      navigate: 'Navigate to URL',
      press: 'Press key'
    };
    return descriptions[action] || action;
  }

  function renderSteps(stepType) {
    const steps = stepType === 'initial' ? initialSteps : perUploadSteps;
    const container = stepType === 'initial' 
      ? elements.initialStepsContainer 
      : elements.perUploadStepsContainer;
    
    if (steps.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    container.innerHTML = steps.map((step, index) => `
      <div class="step-item" data-index="${index}" data-type="${stepType}">
        <div class="step-reorder-buttons">
          <button class="step-move-up" data-index="${index}" data-type="${stepType}" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="step-move-down" data-index="${index}" data-type="${stepType}" ${index === steps.length - 1 ? 'disabled' : ''}>▼</button>
        </div>
        <span class="step-number">${index + 1}</span>
        <div class="step-details step-clickable" data-index="${index}" data-type="${stepType}">
          <span class="step-action">${step.action}</span>
          <span class="step-description">${step.description}</span>
          <span class="step-edit-hint">✎ click to edit</span>
        </div>
        <button class="step-remove" data-index="${index}" data-type="${stepType}">&times;</button>
      </div>
    `).join('');
    
    // Add click to edit listeners
    container.querySelectorAll('.step-clickable').forEach(el => {
      el.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        const type = e.currentTarget.dataset.type;
        showStepModal(type, index);
      });
    });
    
    // Add move up button listeners
    container.querySelectorAll('.step-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        moveStep(type, index, -1);
      });
    });
    
    // Add move down button listeners
    container.querySelectorAll('.step-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        moveStep(type, index, 1);
      });
    });
    
    // Add remove button listeners
    container.querySelectorAll('.step-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering edit
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        if (type === 'initial') {
          initialSteps.splice(index, 1);
          renderSteps('initial');
        } else {
          perUploadSteps.splice(index, 1);
          renderSteps('perUpload');
        }
      });
    });
  }

  // Move step up or down
  function moveStep(stepType, index, direction) {
    const steps = stepType === 'initial' ? initialSteps : perUploadSteps;
    const newIndex = index + direction;
    
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    // Swap the steps
    const temp = steps[index];
    steps[index] = steps[newIndex];
    steps[newIndex] = temp;
    
    renderSteps(stepType);
  }

  // Show validation error in step modal
  function showStepValidationError(message) {
    if (elements.stepValidationError) {
      elements.stepValidationError.textContent = message;
      elements.stepValidationError.classList.remove('hidden');
    }
  }

  // Hide validation error in step modal
  function hideStepValidationError() {
    if (elements.stepValidationError) {
      elements.stepValidationError.textContent = '';
      elements.stepValidationError.classList.add('hidden');
    }
  }

  // Hide Modal
  function hideModal(modal) {
    modal.classList.add('hidden');
    // Clear any validation errors when closing
    hideStepValidationError();
  }

  // Update Start Button State
  function updateStartButton() {
    const hasUrl = elements.targetUrl.value.trim() !== '';
    const hasDocuments = getSelectedDocuments().length > 0;
    elements.startBtn.disabled = !hasUrl || !hasDocuments || isRunning;
  }

  // Get Selected Documents
  function getSelectedDocuments() {
    const checkboxes = elements.documentsList.querySelectorAll('.doc-checkbox:checked');
    return Array.from(checkboxes).map(cb => {
      const docPath = cb.dataset.path;
      return documents.find(d => d.path === docPath);
    }).filter(Boolean);
  }

  // Start Automation
  async function startAutomation() {
    isRunning = true;
    elements.startBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
    elements.progressContainer.classList.remove('hidden');
    
    saveConfig();
    
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: parseInt(elements.waitAfterUpload.value) || 2000,
      waitAfterSubmit: parseInt(elements.waitAfterSubmit.value) || 3000,
      headless: elements.headless.checked,
      documents: getSelectedDocuments(),
      initialSteps: initialSteps,
      perUploadSteps: perUploadSteps
    };
    
    addLog('Starting automation...', 'info');
    
    const result = await window.electronAPI.startAutomation(config);
    
    if (result.success) {
      const { successful, failed } = result.result;
      addLog(`Automation completed: ${successful.length} successful, ${failed.length} failed`, 
        failed.length > 0 ? 'warning' : 'success');
    } else {
      addLog(`Automation error: ${result.error}`, 'error');
    }
    
    isRunning = false;
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    updateStartButton();
  }

  // Stop Automation
  async function stopAutomation() {
    addLog('Stopping automation...', 'warning');
    await window.electronAPI.stopAutomation();
    isRunning = false;
    elements.startBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
    updateStartButton();
  }

  // Handle Progress Updates
  function handleProgress(progress) {
    elements.progressFill.style.width = `${progress.percentage}%`;
    elements.progressText.textContent = `${progress.current}/${progress.total} (${progress.percentage}%)`;
    elements.currentFile.textContent = progress.currentFile ? `Uploading: ${progress.currentFile}` : '';
  }

  // Handle Log Messages
  function handleLog(log) {
    addLog(log.message, log.type);
  }

  // Add Log Entry
  function addLog(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-message">${message}</span>
    `;
    elements.logsContainer.appendChild(entry);
    elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
  }

  // Clear Logs
  function clearLogs() {
    elements.logsContainer.innerHTML = '';
  }

  // Save/Load Config to localStorage (auto-save)
  function saveConfig() {
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: elements.waitAfterUpload.value,
      waitAfterSubmit: elements.waitAfterSubmit.value,
      headless: elements.headless.checked,
      initialSteps: initialSteps,
      perUploadSteps: perUploadSteps
    };
    localStorage.setItem('uiTesterConfig', JSON.stringify(config));
  }

  function loadConfig() {
    const saved = localStorage.getItem('uiTesterConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        applyConfig(config);
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
  }

  // Apply config to the UI
  function applyConfig(config) {
    elements.targetUrl.value = config.targetUrl || '';
    elements.uploadSelector.value = config.uploadSelector || "input[type='file']";
    elements.submitSelector.value = config.submitSelector || '';
    elements.waitAfterUpload.value = config.waitAfterUpload || '2000';
    elements.waitAfterSubmit.value = config.waitAfterSubmit || '3000';
    elements.headless.checked = config.headless || false;
    initialSteps = config.initialSteps || [];
    perUploadSteps = config.perUploadSteps || [];
    renderSteps('initial');
    renderSteps('perUpload');
    
    // If a folder path is saved, try to load it
    if (config.folderPath) {
      selectedFolder = config.folderPath;
      elements.folderPath.textContent = selectedFolder;
      // Rescan the folder
      window.electronAPI.scanFolder(selectedFolder).then(scanResult => {
        if (scanResult.success) {
          documents = scanResult.documents;
          renderDocuments();
          elements.documentsContainer.classList.remove('hidden');
          updateStartButton();
        }
      });
    }
    
    updateStartButton();
  }

  // Get current config object
  function getCurrentConfig() {
    return {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: elements.waitAfterUpload.value,
      waitAfterSubmit: elements.waitAfterSubmit.value,
      headless: elements.headless.checked,
      initialSteps: initialSteps,
      perUploadSteps: perUploadSteps,
      folderPath: selectedFolder
    };
  }

  // Save config to file
  async function handleSaveConfig() {
    const config = getCurrentConfig();
    const result = await window.electronAPI.saveConfig(config);
    
    if (result.success) {
      addLog(`Configuration saved to: ${result.filePath}`, 'success');
    } else if (!result.canceled) {
      addLog(`Failed to save configuration: ${result.error}`, 'error');
    }
  }

  // Load config from file
  async function handleLoadConfig() {
    const result = await window.electronAPI.loadConfig();
    
    if (result.success) {
      applyConfig(result.config);
      addLog(`Configuration loaded from: ${result.filePath}`, 'success');
    } else if (!result.canceled) {
      addLog(`Failed to load configuration: ${result.error}`, 'error');
    }
  }

  // Add input listener for URL
  elements.targetUrl.addEventListener('input', updateStartButton);

  // Initialize
  init();
});
