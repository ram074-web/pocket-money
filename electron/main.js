// Electron main process. Runs the same Next.js app as the browser version,
// but self-contained: it starts Next's standalone server on a free local
// port, points Prisma at a SQLite file under the OS's per-user app-data
// directory (never inside the installed app, which may not be writable),
// and loads the result in a native window.
const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");

let mainWindow = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Where the Next.js standalone bundle (server.js, .next, node_modules,
// public) lives: resources/app once packaged, .next/standalone in dev.
function getAppDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..", ".next", "standalone");
}

function getDbTemplatePath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "db-template.db")
    : path.join(__dirname, "..", "resources", "db-template.db");
}

// Copies the blank, already-migrated database into the user's app-data
// directory on first launch. Existing data is never touched or overwritten.
function ensureDatabase() {
  const dbPath = path.join(app.getPath("userData"), "pocket-money.db");
  if (!fs.existsSync(dbPath)) {
    const template = getDbTemplatePath();
    if (!fs.existsSync(template)) {
      throw new Error(`Database template missing at ${template}`);
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.copyFileSync(template, dbPath);
  }
  return `file:${dbPath.replace(/\\/g, "/")}`;
}

function waitForServer(port, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 2000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Timed out waiting for the app server to start"));
        else setTimeout(attempt, 250);
      });
      req.on("timeout", () => req.destroy());
    };
    attempt();
  });
}

async function startNextServer() {
  const appDir = getAppDir();
  const serverEntry = path.join(appDir, "server.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Next.js standalone build missing at ${serverEntry}. Run "npm run desktop:prepare" first.`);
  }

  const port = await getFreePort();
  process.env.DATABASE_URL = ensureDatabase();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";
  process.env.NODE_ENV = "production";

  // server.js starts listening on PORT itself and chdir()s into its own
  // directory, so it's required rather than called.
  require(serverEntry);
  await waitForServer(port);
  return port;
}

async function createWindow() {
  const port = await startNextServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Finance & Operations Control Center",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  Menu.setApplicationMenu(null);

  // Send external links to the OS browser rather than a second app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    dialog.showErrorBox("Failed to start", String(err && err.stack ? err.stack : err));
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
