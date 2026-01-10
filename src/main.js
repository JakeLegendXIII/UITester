const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { AutomationEngine } = require('./automation');

let mainWindow;
let automationEngine = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// Select folder dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Folder Containing Documents'
  });
  
  if (result.canceled) {
    return { success: false, path: null };
  }
  
  return { success: true, path: result.filePaths[0] };
});

// Scan folder for documents
ipcMain.handle('scan-folder', async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath);
    const documents = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.json', '.csv'].includes(ext);
      })
      .map(file => {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          extension: path.extname(file).toLowerCase(),
          modified: stats.mtime
        };
      });
    
    return { success: true, documents };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Start automation
ipcMain.handle('start-automation', async (event, config) => {
  try {
    automationEngine = new AutomationEngine(config);
    
    // Set up progress callback
    automationEngine.onProgress((progress) => {
      mainWindow.webContents.send('automation-progress', progress);
    });
    
    automationEngine.onLog((log) => {
      mainWindow.webContents.send('automation-log', log);
    });
    
    const result = await automationEngine.run();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop automation
ipcMain.handle('stop-automation', async () => {
  if (automationEngine) {
    await automationEngine.stop();
    automationEngine = null;
    return { success: true };
  }
  return { success: false, error: 'No automation running' };
});

// Get file content preview
ipcMain.handle('preview-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const extension = path.extname(filePath).toLowerCase();
    
    // Limit preview size
    const preview = content.length > 5000 ? content.substring(0, 5000) + '\n...(truncated)' : content;
    
    return { success: true, content: preview, extension };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Save configuration to file
ipcMain.handle('save-config', async (event, config) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Configuration',
      defaultPath: 'ui-tester-config.json',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(result.filePath, configData, 'utf-8');
    
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load configuration from file
ipcMain.handle('load-config', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Load Configuration',
      filters: [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const config = JSON.parse(content);
    
    return { success: true, config, filePath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
