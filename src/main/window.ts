import { is } from '@electron-toolkit/utils'
import { app, BrowserView, BrowserWindow, Menu, MenuItem, shell } from 'electron'
import windowStateKeeper from 'electron-window-state'
import { join } from 'path'

import icon from '../../build/icon.png?asset'
import { appConfig, titleBarOverlayDark, titleBarOverlayLight } from './config'
import { objectToQueryParams } from './utils'

export function createMainWindow() {
  // Load the previous state with fallback to defaults
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1080,
    defaultHeight: 670
  })

  const theme = appConfig.get('theme') || 'light'

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 1080,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true,
    transparent: process.platform === 'darwin',
    vibrancy: 'fullscreen-ui',
    titleBarStyle: 'hidden',
    titleBarOverlay: theme === 'dark' ? titleBarOverlayDark : titleBarOverlayLight,
    trafficLightPosition: { x: 8, y: 12 },
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false
      // devTools: !app.isPackaged,
    }
  })

  mainWindowState.manage(mainWindow)

  mainWindow.webContents.on('context-menu', () => {
    const menu = new Menu()
    menu.append(new MenuItem({ label: '复制', role: 'copy', sublabel: '⌘ + C' }))
    menu.append(new MenuItem({ label: '粘贴', role: 'paste', sublabel: '⌘ + V' }))
    menu.append(new MenuItem({ label: '剪切', role: 'cut', sublabel: '⌘ + X' }))
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: '全选', role: 'selectAll', sublabel: '⌘ + A' }))
    menu.popup()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    const websiteReg = /accounts.google.com/i

    if (websiteReg.test(details.url)) {
      createMinappWindow({ url: details.url, windowOptions: { width: 1000, height: 680 } })
    } else {
      shell.openExternal(details.url)
    }

    return { action: 'deny' }
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    if (details.responseHeaders?.['X-Frame-Options']) {
      delete details.responseHeaders['X-Frame-Options']
    }
    if (details.responseHeaders?.['x-frame-options']) {
      delete details.responseHeaders['x-frame-options']
    }
    if (details.responseHeaders?.['Content-Security-Policy']) {
      delete details.responseHeaders['Content-Security-Policy']
    }
    if (details.responseHeaders?.['content-security-policy']) {
      delete details.responseHeaders['content-security-policy']
    }
    callback({ cancel: false, responseHeaders: details.responseHeaders })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function createMinappWindow({
  url,
  windowOptions
}: {
  url: string
  windowOptions?: Electron.BrowserWindowConstructorOptions
}) {
  const width = 1000
  const height = 680
  const headerHeight = 40

  const minappWindow = new BrowserWindow({
    width,
    height,
    autoHideMenuBar: true,
    alwaysOnTop: true,
    titleBarOverlay: titleBarOverlayDark,
    titleBarStyle: 'hidden',
    ...windowOptions,
    webPreferences: {
      preload: join(__dirname, '../preload/minapp.js'),
      sandbox: false
    }
  })

  const view = new BrowserView()
  view.setBounds({ x: 0, y: headerHeight, width, height: height - headerHeight })
  view.webContents.loadURL(url)

  const minappWindowParams = {
    title: windowOptions?.title || 'CherryStudio'
  }

  const appPath = app.getAppPath()
  const minappHtmlPath = appPath + '/resources/minapp.html'

  minappWindow.loadURL('file://' + minappHtmlPath + '?' + objectToQueryParams(minappWindowParams))
  minappWindow.setBrowserView(view)
  minappWindow.on('resize', () => {
    view.setBounds({
      x: 0,
      y: headerHeight,
      width: minappWindow.getBounds().width,
      height: minappWindow.getBounds().height - headerHeight
    })
  })

  return minappWindow
}
