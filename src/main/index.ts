import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './database';
import { registerIpcHandlers } from './ipc-handlers';
import { pluginManager } from './plugin';
import { taskManager } from './engine';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: '任务管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setToolTip('任务管理');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.whenReady().then(async () => {
  // 1. 初始化数据库
  await initializeDatabase();

  // 2. 注册 IPC 处理器
  registerIpcHandlers();

  // 3. 加载插件
  await pluginManager.initialize();

  // 4. 初始化任务管理器（加载已有任务到调度器）
  await taskManager.initialize();

  // 5. 创建窗口和托盘
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Windows/Linux 隐藏到托盘，不退出
});

app.on('before-quit', async () => {
  await taskManager.destroy();
  closeDatabase();
});