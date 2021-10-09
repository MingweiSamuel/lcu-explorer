import { app, ipcMain as ipc } from "electron";
import serve from "electron-serve";
import Store from "electron-store";
import LCUConnector from "lcu-connector";
import { createWindow } from "./helpers";

import "./helpers/ipc";

const store = new Store();
const isProd: boolean = process.env.NODE_ENV === "production";

if (isProd) {
  serve({ directory: "app" });
} else {
  app.setPath("userData", `${app.getPath("userData")} (development)`);
}

app.on(
  "certificate-error",
  (event, _webContents, _url, _error, certificate, callback) => {
    if (
      certificate.fingerprint ===
      "sha256/TQ1pFVrt3Msu+IVgubjrrixp75XCuDFovDbcTcqTJjw="
    ) {
      event.preventDefault();
      callback(true);
    } else {
      callback(false);
    }
  }
);

(async () => {
  await app.whenReady();

  const backgroundColor = (): string => {
    if (!store.get("theme")) {
      store.set("theme", "dark");
    }
    const dark = "#222";
    const light = "#DDD";

    if (store.get("theme") === "dark") {
      return light;
    }
    return dark;
  };

  const mainWindow = createWindow("main", {
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    title: "Treeline Explorer",
    frame: false,
    backgroundColor: backgroundColor(),
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      webSecurity: false,
    },
  });

  ipc.on("process:min", () => {
    mainWindow.minimize();
  });

  ipc.on("process:minmax", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    mainWindow.maximizable ? mainWindow.maximize() : mainWindow.unmaximize();
  });

  let credentials;
  const connector = new LCUConnector();
  connector.on("connect", ({ username, port, password, protocol, address }) => {
    console.log("CONNECTED TO LCU");
    credentials = { username, port, password, protocol, address };
    mainWindow.webContents.send("credentialspass", credentials);
  });
  connector.on("disconnect", () => {
    credentials = null;
  });
  connector.start();

  ipc.on("fe-ready", (event, args) => {
    console.log("FE READY");
    if (credentials) {
      console.log(`PASSING CREDENTIALS ${JSON.stringify(credentials)}`);
      event.reply("credentialspass", credentials);
    }
  });

  if (isProd) {
    await mainWindow.loadURL("app://./home.html");
  } else {
    const port = process.argv[2];
    await mainWindow.loadURL(`http://localhost:${port}/home`);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
})();

app.on("window-all-closed", () => {
  app.quit();
});

ipc.on("process:close", () => {
  process.exit(0);
});
