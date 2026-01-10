// UI Tester - Renderer Script
document.addEventListener('DOMContentLoaded', () => {
  // State
  let selectedFolder = null;
  let documents = [];
  let customSteps = [];
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
    customStepsContainer: document.getElementById('customSteps'),
    addStepBtn: document.getElementById('addStepBtn'),
    
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
    closePreviewBtn: document.getElementById('closePreviewBtn')
  };

  // Initialize event listeners
  function init() {
    // Folder selection
    elements.selectFolderBtn.addEventListener('click', handleFolderSelect);
    
    // Filters
    elements.filterJson.addEventListener('change', renderDocuments);
    elements.filterCsv.addEventListener('change', renderDocuments);
    
    // Steps
    elements.addStepBtn.addEventListener('click', () => showStepModal());
    elements.closeStepBtn.addEventListener('click', () => hideModal(elements.stepModal));
    elements.stepAction.addEventListener('change', updateStepModalFields);
    elements.saveStepBtn.addEventListener('click', saveStep);
    
    // Control
    elements.startBtn.addEventListener('click', startAutomation);
    elements.stopBtn.addEventListener('click', stopAutomation);
    
    // Logs
    elements.clearLogsBtn.addEventListener('click', clearLogs);
    
    // Preview Modal
    elements.closePreviewBtn.addEventListener('click', () => hideModal(elements.previewModal));
    
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
  function showStepModal() {
    // Reset form
    elements.stepAction.value = 'click';
    elements.stepSelector.value = '';
    elements.stepValue.value = '';
    elements.stepDuration.value = '1000';
    elements.stepUrl.value = '';
    elements.stepKey.value = '';
    elements.stepDescription.value = '';
    updateStepModalFields();
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
          alert('Please enter a selector');
          return;
        }
        break;
      case 'fill':
      case 'type':
        step.selector = elements.stepSelector.value;
        step.value = elements.stepValue.value;
        if (!step.selector) {
          alert('Please enter a selector');
          return;
        }
        break;
      case 'wait':
        step.duration = parseInt(elements.stepDuration.value) || 1000;
        break;
      case 'navigate':
        step.url = elements.stepUrl.value;
        if (!step.url) {
          alert('Please enter a URL');
          return;
        }
        break;
      case 'press':
        step.key = elements.stepKey.value;
        if (!step.key) {
          alert('Please enter a key');
          return;
        }
        break;
    }
    
    customSteps.push(step);
    renderCustomSteps();
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

  function renderCustomSteps() {
    if (customSteps.length === 0) {
      elements.customStepsContainer.innerHTML = '';
      return;
    }
    
    elements.customStepsContainer.innerHTML = customSteps.map((step, index) => `
      <div class="step-item">
        <span class="step-number">${index + 1}</span>
        <div class="step-details">
          <span class="step-action">${step.action}</span>
          <span class="step-description">${step.description}</span>
        </div>
        <button class="step-remove" data-index="${index}">&times;</button>
      </div>
    `).join('');
    
    // Add remove button listeners
    elements.customStepsContainer.querySelectorAll('.step-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        customSteps.splice(index, 1);
        renderCustomSteps();
      });
    });
  }

  // Hide Modal
  function hideModal(modal) {
    modal.classList.add('hidden');
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
      customSteps: customSteps
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

  // Save/Load Config
  function saveConfig() {
    const config = {
      targetUrl: elements.targetUrl.value,
      uploadSelector: elements.uploadSelector.value,
      submitSelector: elements.submitSelector.value,
      waitAfterUpload: elements.waitAfterUpload.value,
      waitAfterSubmit: elements.waitAfterSubmit.value,
      headless: elements.headless.checked,
      customSteps: customSteps
    };
    localStorage.setItem('uiTesterConfig', JSON.stringify(config));
  }

  function loadConfig() {
    const saved = localStorage.getItem('uiTesterConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        elements.targetUrl.value = config.targetUrl || '';
        elements.uploadSelector.value = config.uploadSelector || "input[type='file']";
        elements.submitSelector.value = config.submitSelector || '';
        elements.waitAfterUpload.value = config.waitAfterUpload || '2000';
        elements.waitAfterSubmit.value = config.waitAfterSubmit || '3000';
        elements.headless.checked = config.headless || false;
        customSteps = config.customSteps || [];
        renderCustomSteps();
      } catch (e) {
        console.error('Error loading config:', e);
      }
    }
  }

  // Add input listener for URL
  elements.targetUrl.addEventListener('input', updateStartButton);

  // Initialize
  init();
});
