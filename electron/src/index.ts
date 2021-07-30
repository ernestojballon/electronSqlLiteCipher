/* eslint-disable prefer-arrow/prefer-arrow-functions */
/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { ipcMain, dialog, app, BrowserWindow, Menu, MenuItem, nativeImage, Tray } from 'electron';
import { join } from 'path';
import electronIsDev from 'electron-is-dev';
import electronServe from 'electron-serve';
import { CapElectronEventEmitter, CapacitorSplashScreen, getCapacitorConfig, setupCapacitorElectronPlugins, setupElectronDeepLinking } from '@capacitor-community/electron';
import fs = require('fs');
const sqlite3 = require('@journeyapps/sqlcipher');

// Get Config options from capacitor.config file
const CapacitorFileConfig = getCapacitorConfig();

/////////////////////// Menus and Configs - Modify Freely //////////////////////////////////////////////
const TrayMenuTemplate = [
  new MenuItem({ label: 'Quit App', role: 'quit' })
];
const getMenuTemplate = (mainWindow: BrowserWindow) => [
    { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
    { role: 'viewMenu' },
    {  role: 'help',
       submenu: [
         {
            label: 'SelectAndQueryDatabase',
            click: ()=>getFilePath()
                        .then((filePath)=>openDatabase(filePath))
                        .then((database)=>{
                          mainWindow.webContents.send('trigger-alert',{connected:'connected'});
                          return Promise.resolve(database);
                        })
                        .then((database)=>queryDatabase(database))
                        .then((tables)=>{
                          mainWindow.webContents.send('trigger-alert',tables);
                        })
                        .catch((error)=>{
                          mainWindow.webContents.send('trigger-alert',{connected:'error',message:error.message});
                        })
        },
        {
          label: 'Learn',
          click: ()=>{
            mainWindow.webContents.send('trigger-alert',{hola:'como estas?'});
          },
        }
      ]
    }
  ];
const DeepLinkingConfig = {customProtocol: CapacitorFileConfig.deepLinkingCustomProtocol ?? 'mycapacitorapp'};
////////////////////////////////////////////////////////////////////////////////////////////////////////

// -------------------------------------------------------------------------------------------------- //

/////////////////////// Capacitor Electron Internals Modify At Own risk ////////////////////////////////
class ElectronCapacitorApp {
  private MainWindow: BrowserWindow | null = null;
  private SplashScreen: CapacitorSplashScreen | null = null;
  private TrayIcon: Tray | null = null;
  private loadWebApp;

  constructor() {
    this.loadWebApp = electronServe({
      directory: join(app.getAppPath(), 'app'),
      // The scheme can be changed to whatever you'd like (ex: someapp)
      scheme: CapacitorFileConfig.customUrlScheme ?? 'capacitor-electron',
    });
  }

  private async loadMainWindow(thisRef: any) {
    await thisRef.loadWebApp(thisRef.MainWindow);
  }

  getMainWindow() {
    return this.MainWindow;

  }
  async init() {
    this.MainWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        // Use preload to inject the electron varriant overrides for capacitor plugins.
        // Note: any windows you spawn that you want to include capacitor plugins must have this preload.
        preload: join(app.getAppPath(), 'node_modules', '@capacitor-community', 'electron', 'dist', 'runtime', 'electron-rt.js'),
      },
    });

    this.MainWindow.on('closed', () => {
      if (this.SplashScreen && this.SplashScreen.getSplashWindow() && !this.SplashScreen.getSplashWindow().isDestroyed()) {
        this.SplashScreen.getSplashWindow().close();
      }
    });

    if (CapacitorFileConfig.trayIconAndMenuEnabled) {
      this.TrayIcon = new Tray(nativeImage.createFromPath(join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png')));
      this.TrayIcon.on('double-click', () => {
        if (this.MainWindow) {
          if (this.MainWindow.isVisible()) {
            this.MainWindow.hide();
          } else {
            this.MainWindow.show();
            this.MainWindow.focus();
          }
        }
      });
      this.TrayIcon.on('click', () => {
        if (this.MainWindow) {
          if (this.MainWindow.isVisible()) {
            this.MainWindow.hide();
          } else {
            this.MainWindow.show();
            this.MainWindow.focus();
          }
        }
      });
      this.TrayIcon.setToolTip(app.getName());
      this.TrayIcon.setContextMenu(
        Menu.buildFromTemplate(TrayMenuTemplate)
      );
    }

    // Setup app windows menu bar
    Menu.setApplicationMenu(
      // @ts-ignore
      Menu.buildFromTemplate(getMenuTemplate(this.MainWindow))
    );

    if (CapacitorFileConfig.splashScreenEnabled) {
      this.SplashScreen = new CapacitorSplashScreen({
        imageFilePath: join(app.getAppPath(), 'assets', CapacitorFileConfig.splashScreenImageName ?? 'splash.png'),
        windowWidth: 400,
        windowHeight: 400,
      });
      this.SplashScreen.init(this.loadMainWindow, this);
    } else {
      this.loadMainWindow(this);
    }

    // Link electron plugins in
    setupCapacitorElectronPlugins();

    this.MainWindow.webContents.on('dom-ready', () => {
      if (CapacitorFileConfig.splashScreenEnabled) {
        this.SplashScreen.getSplashWindow().hide();
      }
      if (!CapacitorFileConfig.hideMainWindowOnLaunch) {
        this.MainWindow.show();
      }
      setTimeout(() => {
        if (electronIsDev) {
          this.MainWindow.webContents.openDevTools();
        }
        CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
      }, 400);
    });
  }

}
const myCapacitorApp = new ElectronCapacitorApp();
if (CapacitorFileConfig.deepLinkingEnabled) {
  setupElectronDeepLinking(myCapacitorApp, DeepLinkingConfig);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////

// Run Application
(async () => {
  await app.whenReady();
  await myCapacitorApp.init();
})();

app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async function() {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (myCapacitorApp.getMainWindow().isDestroyed()) {
    await myCapacitorApp.init();
  }
});

// Place all ipc or other electron api calls and custom functionality under this line
ipcMain.on('opendatabase',async ()=>{
  const { shell } = require('electron');
  await shell.openExternal('https://electronjs.org');
});

const getFilePath = (): Promise<string> => dialog
    .showOpenDialog(myCapacitorApp.getMainWindow(), {
      title: 'Select a folder',
      properties: ['openFile'],
    })
    .then(result => {
      const filePath = result.filePaths[0];
      // mainWindow.webContents.send('trigger-alert',{filepath:filePath});
      return Promise.resolve(filePath);
    });

const openDatabase = (filePath)=>new Promise((resolve,reject)=>{
    const db = new sqlite3.Database(filePath, (err) => {
      if (err) {
        reject(new Error('error from opendatabase'));
        console.error(err.message);
      } else {
        resolve(db);
      }
    });
  });

const queryDatabase = db =>new Promise((resolve,reject)=>{
    db.serialize(function() {
      db.run('PRAGMA cipher_compatibility = 4');
      db.run('PRAGMA key = \'secret\'');
      db.all('select * from lorem', function(err, tables) {
        if(err) {
          reject(new Error('error from queryDatabase'));
        }
        resolve(tables);
      });
    });
  });

console.log('hola electron');


