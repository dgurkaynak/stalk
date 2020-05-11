// https://github.com/nayunhwan/Electron-CRA-TypeScript

// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu
} = require('electron');
const url = require('url');
const path = require('path');
const fs = require('fs');
const windowStateKeeper = require('electron-window-state');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
  // Remember window state (position & size)
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });

  // Create the browser window.
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true
    }
  });

  // Bind window events & persist
  mainWindowState.manage(mainWindow);

  // and load the index.html of the app.
  const startUrl =
    process.env.ELECTRON_START_URL ||
    url.format({
      pathname: path.join(__dirname, './build/index.html'),
      protocol: 'file:',
      slashes: true
    });
  mainWindow.loadURL(startUrl);

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });

  // Delegate full-screen events
  mainWindow.on('enter-full-screen', () =>
    mainWindow.webContents.send('enter-full-screen')
  );
  mainWindow.on('leave-full-screen', () =>
    mainWindow.webContents.send('leave-full-screen')
  );
}

// Handle open-file events for following cases:
// - A file is dropped on app dock icon
// - A file is right clicked > Open With > stalk-studio
// Please note that, this only works when app is packaged as an `.app` file
// We just support JSON files, configured for the mac (see: package.json > electron-builder options)
// TODO: Do this for windows and linux
let isAppInitalized = false;
let openFilePathBuffer = [];
app.on('open-file', async (event, filePath) => {
  event.preventDefault();

  if (isAppInitalized) {
    if (mainWindow) {
      mainWindow.webContents.send('open-file', await readFileContent(filePath));
    }
  } else {
    openFilePathBuffer.push(filePath);
  }
});
ipcMain.once('app-initalized', async event => {
  isAppInitalized = true;
  event.reply('app-initalized-response', {
    openFiles: await Promise.all(
      openFilePathBuffer.map(filePath => readFileContent(filePath))
    )
  });
});
function readFileContent(filePath) {
  return new Promise(resolve => {
    fs.readFile(filePath, { encoding: 'utf8' }, (err, data) => {
      if (err)
        return resolve({
          name: path.basename(filePath),
          error: `Could not read file: ${err.message}`
        });
      resolve({ name: path.basename(filePath), content: data });
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  app.quit();
});

app.on('activate', function() {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Clear all the menu, app will handle it
Menu.setApplicationMenu(null);
