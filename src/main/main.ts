/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import onvif from 'node-onvif';
import { spawn } from 'child_process';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// HELPER: Fixes the path issue (Dev vs Prod)
const getBinaryPath = () => {
  const isProd = app.isPackaged;
  const binaryName = process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc';

  if (isProd) {
    // In production, files are packed inside the app
    return path.join(process.resourcesPath, 'bin', binaryName);
  } else {
    // In dev, look at the project root
    return path.join(process.cwd(), 'resources', 'bin', binaryName);
  }
};

// --- UPDATED: Streaming Logic ---

// Fallback URL for testing if no camera is found

const TEST_RTSP_URL = 'rtsp://192.168.0.101:8080/h264_ulaw.sdp'; // <--- Put your link here

ipcMain.handle('start-stream', async (event, rtspUrl) => {
  // If React doesn't send a URL, use the Test Stream
  const targetUrl = rtspUrl || TEST_RTSP_URL;
  const binaryPath = getBinaryPath();

  console.log('Attempting to start go2rtc at:', binaryPath);
  console.log('Streaming Target:', targetUrl);

  // We pass the configuration directly via the "-config" argument as a JSON string.
  // This tells go2rtc: "Create a stream named 'camera1' from this RTSP URL"
  const config = JSON.stringify({
    streams: {
      camera1: targetUrl,
    },
    log: {
      level: 'info', // Useful for debugging
    },
  });

  const subprocess = spawn(binaryPath, ['-config', config]);

  subprocess.stdout.on('data', (data) => {
    console.log(`go2rtc: ${data}`);
  });

  subprocess.stderr.on('data', (data) => {
    console.error(`go2rtc error: ${data}`);
  });

  return 'Stream Engine Started';
});

// --------------------------------

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
    // --- UPDATED: Commented out to prevent "sandboxed_renderer" crash ---
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

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
