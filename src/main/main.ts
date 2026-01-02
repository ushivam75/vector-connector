/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn, exec, ChildProcess } from 'child_process';
import ngrok from 'ngrok';
import { updateCameraUrl, startHeartbeat } from './firebase'; // Import your Firebase helper

// Global tracker
let go2rtcProcess: ChildProcess | null = null;

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

const getBinFolder = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(process.cwd(), 'resources', 'bin');
};

// --- ROBUST CLEANUP FUNCTION ---
const forceKillAll = () => {
  return new Promise((resolve) => {
    console.log('🧹 Cleaning up old processes...');

    // Kill internal reference
    if (go2rtcProcess) {
      go2rtcProcess.kill();
      go2rtcProcess = null;
    }

    // Force kill Windows processes (Nuclear Option)
    if (process.platform === 'win32') {
      exec('taskkill /F /IM ngrok.exe /IM go2rtc.exe', () => {
        // We ignore errors here because if the process isn't found, that's good!
        resolve(true);
      });
    } else {
      exec('pkill ngrok; pkill go2rtc', () => resolve(true));
    }
  });
};

// --- STREAMING LOGIC ---
// const TEST_RTSP_URL = 'rtsp://192.168.0.103:8080/h264_ulaw.sdp';

// Remove the 'const TEST_RTSP_URL = ...' line if it exists at the top

ipcMain.handle('start-stream', async (event, rtspUrl) => {
  // STEP 1: NUKE EVERYTHING FIRST
  await forceKillAll();
  await new Promise((r) => setTimeout(r, 1000));

  // STEP 2: Start go2rtc
  // HERE IS THE CHANGE: We use the rtspUrl passed from the UI
  // If for some reason it's empty, we throw an error
  if (!rtspUrl) {
    return { status: 'Error', error: 'No RTSP URL provided' };
  }

  const binFolder = getBinFolder();
  const go2rtcBinary = path.join(
    binFolder,
    process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc',
  );

  console.log(`🚀 Starting go2rtc with source: ${rtspUrl}`);

  // Use the dynamic URL in the config
  const config = JSON.stringify({
    streams: { camera1: rtspUrl },
    log: { level: 'info' },
  });

  go2rtcProcess = spawn(go2rtcBinary, ['-config', config]);

  // STEP 3: Start Ngrok (The rest remains exactly the same...)
  await new Promise((r) => setTimeout(r, 2000));

  try {
    await ngrok.disconnect();
    const ngrokDir = binFolder;
    console.log('🚀 Starting Ngrok...');

    const publicUrl = await ngrok.connect({
      addr: 1984,
      authtoken: '37IlsL0oISNCJzOX7q6hNCRHq4m_7L8b5SYzdnDLy5wEbAgr', // Your Token
      binPath: () => ngrokDir,
    });

    console.log('--- SUCCESS: PUBLIC URL ---');
    console.log(publicUrl);

    // Save to Firebase
    updateCameraUrl('home_1', publicUrl);
    startHeartbeat('home_1');

    return { status: 'Stream Started', url: publicUrl };
  } catch (err: any) {
    console.error('Tunnel Error:', err);
    return { status: 'Error', error: err.message || 'Unknown Tunnel Error' };
  }
});

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    // await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  new AppUpdater();
};

app.on('window-all-closed', () => {
  // Also try to clean up on close
  forceKillAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  forceKillAll();
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
