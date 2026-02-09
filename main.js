const { app, BrowserWindow, Tray, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'icon.ico'), // Optional: Add your AI icon
    show: false // Start hidden
  });

  mainWindow.loadURL('http://localhost:3001');
  
  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide to tray when closed
  mainWindow.on('close', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  // Skip tray creation for now - focus on main window
  console.log('🔧 Tray creation skipped for simplicity');
}

// Start backend services when app is ready
app.whenReady().then(() => {
  console.log('🚀 AI Assistant starting...');
  
  // Start Ollama in background
  spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
  console.log('🧠 Ollama started');
  
  // Start Python backend
  spawn('python', ['test_server.py'], { detached: true, stdio: 'ignore' });
  console.log('🔧 Backend started');
  
  // Create UI
  createWindow();
  createTray();
  
  // Auto-start on login
  app.setLoginItemSettings({
    openAtLogin: true
  });
  
  console.log('✅ AI Assistant is now running!');
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Don't quit on macOS - keep in tray
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAll().length === 0) {
    createWindow();
  }
});
