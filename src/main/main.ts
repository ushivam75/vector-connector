/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { spawn } from 'child_process';
import ngrok from 'ngrok';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// --- HELPER: Finds the 'resources/bin' FOLDER ---
const getBinFolder = () => {
  const isProd = app.isPackaged;
  if (isProd) {
    return path.join(process.resourcesPath, 'bin');
  } else {
    return path.join(process.cwd(), 'resources', 'bin');
  }
};

// --- STREAMING LOGIC ---

// Fallback URL for testing
const TEST_RTSP_URL = 'rtsp://192.168.0.101:8080/h264_ulaw.sdp';

ipcMain.handle('start-stream', async (event, rtspUrl) => {
  // 1. Setup the Local Stream (go2rtc)
  const targetUrl = rtspUrl || TEST_RTSP_URL;
  const binFolder = getBinFolder();

  // Go2RTC needs the specific FILE path
  const go2rtcBinary = path.join(
    binFolder,
    process.platform === 'win32' ? 'go2rtc.exe' : 'go2rtc',
  );

  console.log('Attempting to start go2rtc at:', go2rtcBinary);

  const config = JSON.stringify({
    streams: {
      camera1: targetUrl,
    },
    log: {
      level: 'info',
    },
  });

  const subprocess = spawn(go2rtcBinary, ['-config', config]);

  subprocess.stdout.on('data', (data) => {
    console.log(`go2rtc: ${data}`);
  });

  subprocess.stderr.on('data', (data) => {
    console.error(`go2rtc error: ${data}`);
  });

  // 2. Setup the Public Tunnel (ngrok)

  // Wait 2 seconds for go2rtc to fully start
  await new Promise((r) => setTimeout(r, 2000));

  try {
    await ngrok.disconnect();

    // FIX: Ngrok wrapper needs the DIRECTORY, not the file
    // It will automatically append "ngrok.exe" to this path
    const ngrokDir = binFolder;

    console.log('Using ngrok directory:', ngrokDir);

    const publicUrl = await ngrok.connect({
      addr: 1984,
      authtoken: '37IlsL0oISNCJzOX7q6hNCRHq4m_7L8b5SYzdnDLy5wEbAgr',
      binPath: () => ngrokDir, // <--- Sending the FOLDER path now
    });

    console.log('--- PUBLIC ACCESS URL ---');
    console.log(publicUrl);

    return { status: 'Stream Started', url: publicUrl };
  } catch (err: any) {
    console.error('Tunnel Error:', err);
    return { status: 'Error', error: err.message || 'Unknown Tunnel Error' };
  }
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
