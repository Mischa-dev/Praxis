import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { loadManifest, loadGlossary } from './profile-loader'
import { loadModules, watchModules, stopWatchingModules } from './module-loader'
import { loadCloudProviders } from './scope-checker'
import { initDefaultWorkspace, closeDatabase } from './workspace-manager'
import { initProcessManager, cleanupProcessManager } from './process-manager'
import { initWorkflowEngine, loadWorkflows, cleanupWorkflowEngine } from './workflow-engine'
import { initPipelineEngine, cleanupPipelineEngine } from './pipeline-engine'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Load profile data before creating the window
  try {
    loadManifest()
    loadGlossary()
  } catch (err) {
    console.error('Failed to load profile:', err)
    app.quit()
    return
  }

  // Load cloud provider ranges for scope checking
  loadCloudProviders()

  // Initialize the default workspace database
  try {
    initDefaultWorkspace()
  } catch (err) {
    console.error('Failed to initialize workspace:', err)
    app.quit()
    return
  }

  // Load module definitions (async, but we don't block startup on it)
  loadModules().catch((err) => {
    console.warn('Failed to load modules:', err)
  })

  // Watch for module YAML changes (hot-reload)
  watchModules()

  // Initialize process manager with window getter for IPC streaming
  initProcessManager(() => mainWindow)

  // Initialize workflow engine with window getter for progress events
  initWorkflowEngine(() => mainWindow)

  // Initialize pipeline engine with window getter for progress events
  initPipelineEngine(() => mainWindow)

  // Load workflow definitions (sync — small number of files)
  loadWorkflows()

  // Register all IPC handlers (pass window getter since window isn't created yet)
  registerIpcHandlers(() => mainWindow)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  cleanupPipelineEngine()
  cleanupWorkflowEngine()
  cleanupProcessManager()
  stopWatchingModules()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
