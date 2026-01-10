const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class AutomationEngine {
  constructor(config) {
    this.config = {
      targetUrl: config.targetUrl || '',
      uploadSelector: config.uploadSelector || 'input[type="file"]',
      submitSelector: config.submitSelector || '',
      waitAfterUpload: config.waitAfterUpload || 2000,
      waitAfterSubmit: config.waitAfterSubmit || 3000,
      headless: config.headless !== undefined ? config.headless : false,
      documents: config.documents || [],
      initialSteps: config.initialSteps || [],      // Run once at start
      perUploadSteps: config.perUploadSteps || [],  // Run before each upload
      ...config
    };
    
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isRunning = false;
    this.progressCallback = null;
    this.logCallback = null;
  }
  
  onProgress(callback) {
    this.progressCallback = callback;
  }
  
  onLog(callback) {
    this.logCallback = callback;
  }
  
  log(message, type = 'info') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    
    if (this.logCallback) {
      this.logCallback(logEntry);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
  
  emitProgress(current, total, status, currentFile = '') {
    if (this.progressCallback) {
      this.progressCallback({
        current,
        total,
        percentage: Math.round((current / total) * 100),
        status,
        currentFile
      });
    }
  }
  
  async run() {
    this.isRunning = true;
    const results = {
      successful: [],
      failed: [],
      startTime: new Date(),
      endTime: null
    };
    
    try {
      this.log('Starting automation engine...');
      
      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        slowMo: 100 // Slow down for visibility
      });
      
      this.context = await this.browser.newContext({
        acceptDownloads: true,
        viewport: { width: 1280, height: 720 }
      });
      
      this.page = await this.context.newPage();
      
      // Navigate to target URL
      this.log(`Navigating to ${this.config.targetUrl}`);
      await this.page.goto(this.config.targetUrl, { waitUntil: 'networkidle' });
      this.log('Page loaded successfully');
      
      // Execute initial steps ONCE at the start (e.g., login, accept cookies)
      if (this.config.initialSteps.length > 0) {
        this.log('Running initial steps (login, setup, etc.)...');
        await this.executeCustomSteps(this.config.initialSteps);
      }
      
      // Check if UI Automation Only mode
      if (this.config.uiAutomationOnly) {
        this.log('UI Automation Only mode - skipping file uploads', 'info');
        this.emitProgress(1, 1, 'completed');
      } else {
        const documents = this.config.documents;
        const total = documents.length;
        
        for (let i = 0; i < documents.length; i++) {
          if (!this.isRunning) {
            this.log('Automation stopped by user', 'warning');
            break;
          }
          
          const doc = documents[i];
          this.emitProgress(i + 1, total, 'uploading', doc.name);
          
          try {
            // Execute per-upload steps before EACH document (e.g., open menu, click import)
            if (this.config.perUploadSteps.length > 0) {
              this.log(`Running per-upload steps for: ${doc.name}`);
              await this.executeCustomSteps(this.config.perUploadSteps);
            }
            
            await this.uploadDocument(doc);
            results.successful.push(doc);
            this.log(`✓ Successfully uploaded: ${doc.name}`, 'success');
          } catch (error) {
            results.failed.push({ document: doc, error: error.message });
            this.log(`✗ Failed to upload ${doc.name}: ${error.message}`, 'error');
          }
          
          // Wait between uploads
          if (i < documents.length - 1) {
            await this.page.waitForTimeout(this.config.waitAfterUpload);
          }
        }
      }
      
    } catch (error) {
      this.log(`Automation error: ${error.message}`, 'error');
      throw error;
    } finally {
      results.endTime = new Date();
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.isRunning = false;
      this.log('Automation completed');
      
      // Handle progress for UI automation only vs file upload mode
      if (this.config.uiAutomationOnly) {
        this.emitProgress(1, 1, 'completed');
      } else {
        this.emitProgress(results.successful.length, this.config.documents.length, 'completed');
      }
    }
    
    return results;
  }
  
  async uploadDocument(doc) {
    // Wait for upload input to be available
    const uploadInput = await this.page.waitForSelector(this.config.uploadSelector, {
      state: 'attached',
      timeout: 10000
    });
    
    // Set the file input
    await uploadInput.setInputFiles(doc.path);
    this.log(`File set: ${doc.name}`);
    
    // Wait for any dynamic updates after file selection
    await this.page.waitForTimeout(500);
    
    // Click submit button if specified
    if (this.config.submitSelector) {
      this.log('Clicking submit button...');
      await this.page.click(this.config.submitSelector);
      await this.page.waitForTimeout(this.config.waitAfterSubmit);
      
      // Wait for any navigation or response
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
    
    // Execute any post-upload custom steps
    if (this.config.postUploadSteps && this.config.postUploadSteps.length > 0) {
      await this.executeCustomSteps(this.config.postUploadSteps);
    }
  }
  
  async executeCustomSteps(steps) {
    for (const step of steps) {
      if (!this.isRunning) break;
      
      this.log(`Executing step: ${step.description || step.action}`);
      
      switch (step.action) {
        case 'click':
          await this.page.click(step.selector);
          break;
          
        case 'fill':
          await this.page.fill(step.selector, step.value);
          break;
          
        case 'type':
          await this.page.type(step.selector, step.value, { delay: 50 });
          break;
          
        case 'wait':
          await this.page.waitForTimeout(step.duration || 1000);
          break;
          
        case 'waitForSelector':
          await this.page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
          break;
          
        case 'press':
          await this.page.keyboard.press(step.key);
          break;
          
        case 'navigate':
          await this.page.goto(step.url, { waitUntil: 'networkidle' });
          break;
          
        case 'screenshot':
          await this.page.screenshot({ path: step.path || 'screenshot.png' });
          break;
          
        default:
          this.log(`Unknown action: ${step.action}`, 'warning');
      }
      
      if (step.waitAfter) {
        await this.page.waitForTimeout(step.waitAfter);
      }
    }
  }
  
  async stop() {
    this.isRunning = false;
    this.log('Stopping automation...', 'warning');
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { AutomationEngine };
