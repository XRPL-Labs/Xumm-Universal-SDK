import type {
  XummSdk,
  XummSdkJwt,
  xAppOttData,
  Payload,
  JwtUserdata,
  Storage,
  Push,
} from "xumm-sdk";
import { XummPkce } from "xumm-oauth2-pkce";
import type { XummPkceEvent, ResolvedFlow } from "xumm-oauth2-pkce";
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

/**
 * TODO: Test:
 *    - Vue
 *    - Vite, SSR
 *    - React
 *    - Remix
 *    - ...
 */

/**
 * Scenarios:
 *   - xApp: apikey:        » Go ahead
 *   - xApp: apikey+secret:             » ERROR
 *   - xApp: jwt:           » Go ahead
 * »»» Load SDKJWT + XAPP (UI INTERACTION)
 *
 *   - Browser: apikey      » PKCE
 *   - Browser: api+secret              » ERROR
 *   - Browser: jwt:        » Go ahead
 * »»» Load SDKJWT
 *
 *   - CLI: apikey                      » ERROR
 *   - CLI: jwt             » Go ahead
 *   - CLI: apikey+secret   » Go ahead
 * »»» Load SDK
 *
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
  on<U extends keyof XummPkceEvent>(event: U, listener: XummPkceEvent[U]): this;
  off<U extends keyof xAppEvent>(event: U, listener: xAppEvent[U]): this;
  off<U extends keyof XummPkceEvent>(
    event: U,
    listener: XummPkceEvent[U]
  ): this;
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

interface Environment {
  user: ReturnType<XummSdk["ping"]>;
  ott: ReturnType<XummSdkJwt["getOttData"]>;
  jwt: Record<string, any>;
  openid: Record<string, any>;
  bearer: string;
}

interface Helpers {
  ping: ReturnType<XummSdk["ping"]>;
  getCuratedAssets: ReturnType<XummSdk["getCuratedAssets"]>;
  getKycStatus: ReturnType<XummSdk["getKycStatus"]>;
  getTransaction: ReturnType<XummSdk["getTransaction"]>;
  verifyUserTokens: ReturnType<XummSdk["verifyUserTokens"]>;
  getRates: ReturnType<XummSdk["getRates"]>;
}

/**
 * This is where the magic happens
 */

export class Xumm extends EventEmitter {
  private instance = "0";
  private jwtCredential = false;

  public runtime: Runtime = _runtime;

  public environment?: Environment;
  public payload?: Payload;
  public xapp?: xApp;
  public userdata?: JwtUserdata;
  public backendstore?: Storage;
  public helpers?: Helpers;
  public push?: Push;

  constructor(apiKeyOrJwt: string, apiSecretOrOtt?: string) {
    super();

    instance++;
    this.instance = String(instance);

    if (typeof console?.log !== "undefined") {
      console.log("Constructed Xumm", { runtime });
    }

    if (
      typeof apiKeyOrJwt === "string" &&
      apiKeyOrJwt.split(".").length === 3
    ) {
      this.jwtCredential = true;
      _jwt = apiKeyOrJwt;
    }

    const initOttJwtRuntime = () => {
      if (!_classes?.XummSdkJwt) {
        Object.assign(_classes, {
          XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(apiKeyOrJwt),
        });

        readyPromises.push(this.handleOttJwt());
      }
    };

    if (_runtime.xapp) {
      /**
       * xApp
       */
      if (
        typeof apiKeyOrJwt !== "string" ||
        !(uuidv4re.test(apiKeyOrJwt) || this.jwtCredential)
      ) {
        throw new Error(
          "Running in xApp, constructor requires first param. to be Xumm API Key or JWT"
        );
      }
      if (!_classes?.xApp) {
        Object.assign(_classes, {
          xApp: new (require("xumm-xapp-sdk").xApp)(),
        });
      }
      readyPromises.push(this.handleXappEvents());

      initOttJwtRuntime();
    } else if (_runtime.browser) {
      /**
       * Browser (JWT, PKCE?)
       */
      if (
        typeof apiKeyOrJwt !== "string" ||
        !(uuidv4re.test(apiKeyOrJwt) || this.jwtCredential)
      ) {
        throw new Error(
          "Running in browser, constructor requires first param. to be Xumm API Key or JWT"
        );
      }
      if (!_classes?.XummPkce) {
        Object.assign(_classes, {
          XummPkce: new XummPkce(apiKeyOrJwt, {
            implicit: true,
          }),
        });

        if (_classes.XummPkce) {
          if (this.jwtCredential) {
            initOttJwtRuntime();
          } else {
            readyPromises.push(this.handlePkceEvents());
            readyPromises.push(
              new Promise((resolve) => {
                _classes.XummPkce?.on("success", () => {
                  _classes.XummPkce?.state()?.then((state) => {
                    // state: jwt, me, sdk
                    if (state?.sdk) {
                      Object.assign(_classes, { XummSdkJwt: state.sdk });
                    }
                    if (state?.jwt) {
                      _jwt = state.jwt;
                      console.log("...handleOttJwt");
                      this.handleOttJwt();
                    }
                    resolve(state);
                  });
                });
              })
            );
          }
        }
      }
    } else if (_runtime.cli) {
      /**
       * CLI, Node / ...
       */
      if (typeof apiKeyOrJwt !== "string") {
        throw new Error(
          "Running CLI, constructor needs first param. to be Xumm API Key / raw JWT"
        );
      } else {
        if (uuidv4re.test(apiKeyOrJwt)) {
          // API Key
          if (
            typeof apiSecretOrOtt !== "string" ||
            !uuidv4re.test(apiSecretOrOtt)
          ) {
            throw new Error(
              "Running CLI, constructor first param. is API Key, but second param. isn't a valid API Secret"
            );
          }
        }
        if (
          !uuidv4re.test(apiKeyOrJwt) &&
          apiKeyOrJwt.split(".").length !== 3
        ) {
          throw new Error(
            "Running CLI, constructor first param. not a valid JWT, nor a valid API Key"
          );
        }

        // All fine
        if (!_classes?.XummSdk) {
          Object.assign(_classes, {
            XummSdk: new (require("xumm-sdk").XummSdk)(
              apiKeyOrJwt,
              apiSecretOrOtt
            ),
          });
        }
      }
    }
  }

  public async ready(): Promise<this> {
    await Promise.all(readyPromises);
    return this;
  }

  /**
   * xApp
   */
  public async getOttData(): Promise<xAppOttData | undefined> {
    if (this.jwtCredential || _jwt !== "") return;
    await Promise.all(readyPromises);
    return _ott;
  }

  public async getJwt(): Promise<string> {
    await Promise.all(readyPromises);
    return _jwt;
  }

  public async getJwtData(): Promise<Record<string, any>> {
    await Promise.all(readyPromises);
    return _jwtData;
  }

  public async selectDestination(): Promise<boolean | Error | void> {
    await Promise.all(readyPromises);
    if (_classes?.xApp) {
      return _classes.xApp.selectDestination();
    }
  }

  /**
   * SDK
   */
  public async ping(): Promise<ReturnType<XummSdk["ping"]> | undefined> {
    // TODO: What if not JWT but regular?
    await Promise.all(readyPromises);
    return (_classes?.XummSdkJwt || _classes?.XummSdk)?.ping();
  }

  /**
   * PKCE
   */
  public async authorize(): Promise<ResolvedFlow | undefined> {
    console.log("Authorize");
    return _classes?.XummPkce?.authorize();
  }

  public async state(): Promise<ResolvedFlow | undefined> {
    return _classes?.XummPkce?.state();
  }

  public async logout() {
    Object.assign(_classes, { XummSdkJwt: undefined });
    return _classes?.XummPkce?.logout();
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

  private async handlePkceEvents() {
    // Always attach event listeners
    // So no:  && !_initialized.XummPkce
    if (_classes?.XummPkce) {
      _initialized.XummPkce = true;

      _classes.XummPkce.on("retrieved", () => {
        this.emit("retrieved");
      });
      _classes.XummPkce.on("success", () => {
        this.emit("success");
      });
      _classes.XummPkce.on("error", (data: Error) => {
        this.emit("error", data);
      });
    }
  }

  /**
   * Xumm SDK
   */
  private async handleOttJwt() {
    if (_classes?.XummSdkJwt && !_initialized.XummSdkJwt) {
      _initialized.XummSdkJwt = true;

      const doNotFetchJwtOtt = this.jwtCredential || _jwt !== "";

      if (!doNotFetchJwtOtt) {
        readyPromises.push(_classes.XummSdkJwt.getOttData());
        readyPromises.push(_classes.XummSdkJwt.getJwt());
      }

      const ott = !doNotFetchJwtOtt
        ? await _classes.XummSdkJwt.getOttData()
        : null;
      const jwt = !doNotFetchJwtOtt ? await _classes.XummSdkJwt.getJwt() : _jwt;

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
