import type { XummSdk, XummSdkJwt, xAppOttData } from "xumm-sdk";
import type { XummPkce } from "xumm-oauth2-pkce";
import type {
  xApp,
  xAppEvent,
  qrEventData,
  payloadEventData,
  destinationEventData,
} from "xumm-xapp-sdk";
import { EventEmitter } from "events";

/**
 * Development?
 *   npm run watch (tsc in watch mode)
 *   npm run browserify-watch (watch, browserify tsc output)
 *   npm run serve (webserver, :3001)
 *   npm run dev (watch, nodemon dist/samples/index.js)
 *   ngrok start dev (local :3001 to https:// dev URL)
 *     > https://.../sample/
 */

/**
 * TODO:
 *    - Add all PKCE methods
 *    - Add all PKCE events
 * 
 *    -- BOTH XummSdk and XummSdkJwt
 *      - Add all SDK methods
 *      - Add all SDK events
 * 
 *    - Add all xAppSDK methods
 *    - Add all xAppSDK events
 */

enum Runtimes {
  cli = "cli",
  browser = "browser",
  xapp = "xapp",
}

type Runtime = Record<Runtimes, boolean>;

const _runtime: Runtime = {
  cli: false,
  browser: false,
  xapp: false,
};

interface Classes {
  XummSdk?: XummSdk;
  XummSdkJwt?: XummSdkJwt;
  XummPkce?: XummPkce;
  xApp?: xApp;
}

const uuidv4re = new RegExp(
  "^[0-9(a-f|A-F)]{8}-[0-9(a-f|A-F)]{4}-4[0-9(a-f|A-F)]{3}-[89ab][0-9(a-f|A-F)]{3}-[0-9(a-f|A-F)]{12}$"
);

const _classes: Classes = {};

const _env = typeof process === "object" && process ? process?.env || {} : {};

Object.assign(_runtime, {
  cli:
    Object.keys(_env).indexOf("NODE") > -1 ||
    Object.keys(_env).indexOf("SHELL") > -1 ||
    Object.keys(_env).indexOf("TERM") > -1 ||
    Object.keys(_env).indexOf("PATH") > -1,
});

Object.assign(_runtime, {
  browser:
    (typeof process === "object" && process && (process as any)?.browser) ||
    (typeof document === "object" &&
      document &&
      (document as Document)?.location),
});

Object.assign(_runtime, {
  xapp: _runtime.browser && !!navigator.userAgent.match(/xumm\/xapp/i),
});

const runtime = (Object.keys(_runtime) as (keyof typeof Runtimes)[]).filter(
  (r) => _runtime[r]
);

export declare interface Xumm {
  on<U extends keyof xAppEvent>(event: U, listener: xAppEvent[U]): this;
  off<U extends keyof xAppEvent>(event: U, listener: xAppEvent[U]): this;
}

const readyPromises: Promise<any>[] = [];

const _initialized = {
  XummSdk: false,
  XummSdkJwt: false,
  XummPkce: false,
  xApp: false,
};

let _ott: xAppOttData | undefined;
let _jwt: string = "";
let _jwtData: Record<string, any> = {};
// let _me: Record<string, any>;

let instance = 0;

export class Xumm extends EventEmitter {
  private instance = "?";

  constructor(apiKeyOrJwt: string, apiSecretOrOtt?: string) {
    super();

    instance++;
    this.instance = String(instance);

    if (typeof console?.log !== "undefined") {
      console.log("Constructed Xumm", { runtime });
    }

    if (runtime.indexOf("xapp") > -1) {
      if (typeof apiKeyOrJwt !== "string" || !uuidv4re.test(apiKeyOrJwt)) {
        throw new Error(
          "Running in xApp, constructor requires first param. to be Xumm API Key"
        );
      }
      if (!_classes?.xApp) {
        Object.assign(_classes, {
          xApp: new (require("xumm-xapp-sdk").xApp)(),
        });
      }
      readyPromises.push(this.handleXappEvents());

      if (!_classes?.XummSdkJwt) {
        Object.assign(_classes, {
          XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(apiKeyOrJwt),
        });

        readyPromises.push(this.handleOttJwt());
      }
    }

    // if (runtime.indexOf("cli") > -1) {
    //   if (!_classes?.XummSdk) {
    //     Object.assign(_classes, {
    //       XummSdk: new (require("xumm-sdk").XummSdk)(
    //         apiKeyOrJwt,
    //         apiSecretOrOtt
    //       ),
    //     });
    //   }
    //   if (!_classes?.XummSdkJwt) {
    //     Object.assign(_classes, {
    //       // XummSdkJwt: new XummSdkJwt(apiKeyOrJwt, apiSecretOrOtt),
    //     });
    //   }
    // }

    // if (runtime.indexOf("browser") > -1) {
    //   if (!_classes?.XummSdk) {
    //     Object.assign(_classes, {
    //       XummSdk: new (require("xumm-sdk").XummSdk)(
    //         apiKeyOrJwt,
    //         apiSecretOrOtt
    //       ),
    //     });
    //   }
    //   if (!_classes?.XummSdkJwt) {
    //     Object.assign(_classes, {
    //       XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(
    //         apiKeyOrJwt,
    //         apiSecretOrOtt
    //       ),
    //     });
    //   }
    //   if (!_classes?.XummPkce) {
    //     Object.assign(_classes, {
    //       XummPkce: new (require("xumm-oauth2-pkce").XummPkce)(
    //         apiKeyOrJwt,
    //         apiSecretOrOtt
    //       ),
    //     });
    //   }
    // }
  }

  public async ready(): Promise<void> {
    await Promise.all(readyPromises);
    return;
  }

  /**
   * xApp
   */
  public getOttData(): xAppOttData | undefined {
    return _ott;
  }

  public getJwt(): string {
    return _jwt;
  }

  public getJwtData(): Record<string, any> {
    return _jwtData;
  }

  public selectDestination(): Promise<boolean | Error> | void {
    if (_classes?.xApp) {
      return _classes.xApp.selectDestination();
    }
  }

  /**
   * SDK
   */
  public ping() {
    // TODO: What if not JWT but regular?
    return _classes?.XummSdkJwt?.ping();
  }

  /**
   * Handlers (setup)
   */
  private async handleXappEvents() {
    // Always attach event listeners
    // So no:  && !_initialized.xApp
    if (_classes?.xApp) {
      _initialized.xApp = true;

      _classes.xApp.on("qr", (data: qrEventData) => {
        this.emit("qr", data, this.instance);
      });
      _classes.xApp.on("payload", (data: payloadEventData) => {
        this.emit("payload", data, this.instance);
      });
      _classes.xApp.on("destination", (data: destinationEventData) => {
        this.emit("destination", data, this.instance);
      });
    }
  }

  /**
   * Xumm SDK
   */
  private async handleOttJwt() {
    if (_classes?.XummSdkJwt && !_initialized.XummSdkJwt) {
      _initialized.XummSdkJwt = true;

      readyPromises.push(_classes.XummSdkJwt.getOttData());
      readyPromises.push(_classes.XummSdkJwt.getJwt());

      const ott = await _classes.XummSdkJwt.getOttData();
      const jwt = await _classes.XummSdkJwt.getJwt();

      if (ott) {
        _ott = ott;
      }

      if (jwt) {
        _jwt = jwt;
        try {
          _jwtData = JSON.parse(atob(_jwt.split(".")?.[1]));
        } catch (e) {
          console.log("Error decoding JWT", (e as Error)?.message || "");
        }
      }

      if (typeof console?.log !== "undefined") {
        console.log({ ott, jwt });
      }
    }
  }
}
