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

// If we want to simulate an overall async state / delay
// readyPromises.push(
//   new Promise((resolve) => {
//     setTimeout(function () {
//       resolve(null);
//     }, 1000);
//   })
// );

/**
 * The Promisified type takes an entire class and expects all methods
 * to return a Promise of their method's native return values
 */
type Promisified<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<R>
    : T[K];
};

/**
 * Wrap a function into an awaiter, till the entire object is ready
 */
const Asyncify = async <Type>(ReturnValue: () => Type) => {
  await Promise.all(readyPromises);
  return await ReturnValue();
};

/**
 * Take an entire constructed class & wrap all responses
 * in a promise (Asyncify) that waits for this entire class
 * to be ready.
 */
const Proxify = (ObjectToProxy: object) => {
  return new Proxy<any>(ObjectToProxy, {
    get(obj, prop) {
      if (
        ["on", "off"].indexOf(String(prop)) < 0 && // Events
        (typeof obj[prop as keyof typeof obj] === "function" ||
          obj.constructor.name === "Promise")
      ) {
        return function () {
          if (obj.constructor.name === "Promise") {
            return obj.then((res: typeof obj) =>
              Asyncify(() => {
                return res[prop as keyof typeof obj](...arguments);
              })
            );
          }
          return Asyncify(() => {
            return obj[prop as keyof typeof obj](...arguments);
          });
        };
      }
      return obj[prop as keyof typeof obj];
    },
  });
};

const _initialized = {
  XummSdk: false,
  XummSdkJwt: false,
  XummPkce: false,
  xApp: false,
};

let _ott: xAppOttData | undefined;
let _jwt: string = "";
let _jwtData: Record<string, any> = {};
let _me: Partial<ResolvedFlow["me"]> = {};

let instance = 0;

interface Environment {
  ott?: Promise<xAppOttData | undefined>;
  jwt?: Promise<
    | {
        client_id: string;
        scope?: string;
        state?: string;
        aud: string;
        sub: string;
        email?: string;
        app_uuidv4: string;
        app_name: string;
        payload_uuidv4?: string;
        usertoken_uuidv4?: string;
        network_type?: string;
        network_endpoint?: string;
        iat: number;
        exp: number;
        iss: string;
        usr?: string;
        net?: string;
        [key: string]: any;
      }
    | undefined
  >;
  openid?: Promise<
    | {
        sub: string;
        email: string;
        picture: string;
        account: string;
        name: string;
        domain?: string;
        blocked: boolean;
        source?: string;
        kycApproved: boolean;
        proSubscription: boolean;
        networkType: string;
        networkEndpoint: string;
        [key: string]: any;
      }
    | undefined
  >;
  bearer?: Promise<string>;
}

class UnifiedUserData {
  public account = Asyncify<string | undefined>(
    () => _jwtData?.sub ?? _me?.sub ?? _ott?.account_info?.account
  );
  public picture = Asyncify<string | undefined>(
    () =>
      _me?.picture ??
      (_jwtData?.sub ?? _me?.sub ?? _ott?.account_info?.account
        ? `https://xumm.app/avatar/${
            _jwtData?.sub ?? _me?.sub ?? _ott?.account_info?.account
          }.png`
        : undefined)
  );
  public name = Asyncify<string | undefined>(
    () => _me?.name ?? _ott?.account_info?.name
  );
  public domain = Asyncify<string | undefined>(
    () => _me?.domain ?? _ott?.account_info?.domain
  );
  public source = Asyncify<string | undefined>(
    () => _me?.source ?? _ott?.account_info?.source
  );
  public networkType = Asyncify<string | undefined>(
    () =>
      (_me as Record<string, string>)?.networkType ??
      _jwtData.network_type ??
      _ott?.nodetype
  );
  public networkEndpoint = Asyncify<string | undefined>(
    () =>
      (_me as Record<string, string>)?.networkEndpoint ??
      _jwtData.network_ndpoint ??
      _ott?.nodewss
  );
  public blocked = Asyncify<boolean | undefined>(
    () => _me?.blocked ?? _ott?.account_info?.blocked
  );
  public kycApproved = Asyncify<boolean | undefined>(
    () => _me?.kycApproved ?? _ott?.account_info?.kycApproved
  );
  public proSubscription = Asyncify<boolean | undefined>(
    () => _me?.proSubscription ?? _ott?.account_info?.proSubscription
  );
}

/**
 * This is where the magic happens
 */
export class Xumm extends EventEmitter {
  private instance = "0";
  private jwtCredential = false;

  public runtime: Runtime = _runtime;

  public user: UnifiedUserData;
  public environment: Environment;
  public payload?: Promisified<Payload>;
  public xapp?: xApp;
  public userstore?: Promisified<JwtUserdata>;
  public backendstore?: Promisified<Storage>;
  public helpers?: Promisified<
    Pick<
      XummSdkJwt,
      | "ping"
      | "getCuratedAssets"
      | "getKycStatus"
      | "getTransaction"
      | "verifyUserTokens"
      | "getRates"
    >
  >;
  public push?: Promisified<Push>;

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

    /**
     * Handlers (setup)
     */
    const handleXappEvents = async () => {
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
    };

    const handlePkceEvents = async () => {
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
    };

    /**
     * Xumm SDK
     */
    const handleOttJwt = async () => {
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
        const jwt = !doNotFetchJwtOtt
          ? await _classes.XummSdkJwt.getJwt()
          : _jwt;

        if (ott) {
          _ott = ott;
          // TODO: DISABLE
          // console.log("xapp ottdata", _ott);
        }

        if (jwt) {
          _jwt = jwt;
          try {
            _jwtData = JSON.parse(atob(_jwt.split(".")?.[1]));
            // console.log("pkce/xapp jwtdata", _jwtData);
          } catch (e) {
            if (typeof console?.log !== "undefined") {
              console.log("Error decoding JWT", (e as Error)?.message || "");
            }
          }
        }

        if (typeof console?.log !== "undefined") {
          // console.log({ ott, jwt });
        }
      }
    };

    const initOttJwtRuntime = () => {
      if (!_classes?.XummSdkJwt) {
        Object.assign(_classes, {
          XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(apiKeyOrJwt),
        });

        readyPromises.push(handleOttJwt());
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
      readyPromises.push(handleXappEvents());

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
            const handlePkceState = (
              resolve: (value: ResolvedFlow | undefined) => void
            ) => {
              _classes.XummPkce?.state()?.then((state) => {
                // state: jwt, me, sdk
                if (state?.sdk && !_classes?.XummSdkJwt) {
                  Object.assign(_classes, { XummSdkJwt: state.sdk });
                  Object.assign(_me, { ...(state?.me || {}) });
                }
                if (state?.jwt && _jwt === "") {
                  _jwt = state.jwt;
                  handleOttJwt();
                }
                resolve(state);
              });
            };
            readyPromises.push(handlePkceEvents());
            readyPromises.push(
              new Promise(
                (resolve: (value: ResolvedFlow | undefined) => void) => {
                  _classes.XummPkce?.on("retrieved", () => {
                    handlePkceState(resolve);
                  });
                  _classes.XummPkce?.on("success", () => {
                    handlePkceState(resolve);
                  });
                }
              )
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

    /**
     * Bootstrap class properties
     */
    this.user = new UnifiedUserData();
    this.environment = {
      jwt: Asyncify(() => _jwtData) as Environment["jwt"],
      ott: Asyncify(() => _ott),
      openid: Asyncify(() => _me) as Environment["openid"],
      bearer: Asyncify(() => _jwt),
    };
    /**
     * Xumm SDK mapped
     */
    this.helpers = Proxify(
      Asyncify(
        () => (_classes.XummSdk || _classes.XummSdkJwt) as unknown as XummSdkJwt
      )
    );

    this.push = Proxify(
      Asyncify(
        () =>
          ((_classes.XummSdk || _classes.XummSdkJwt) as unknown as XummSdkJwt)
            .Push
      )
    );

    this.payload = Proxify(
      Asyncify(
        () =>
          ((_classes.XummSdk || _classes.XummSdkJwt) as unknown as XummSdkJwt)
            .payload
      )
    );

    this.userstore = Proxify(
      Asyncify(
        () =>
          ((_classes.XummSdk || _classes.XummSdkJwt) as unknown as XummSdkJwt)
            .jwtUserdata
      )
    );

    this.backendstore = Proxify(
      Asyncify(
        () =>
          ((_classes.XummSdk || _classes.XummSdkJwt) as unknown as XummSdkJwt)
            .storage
      )
    );

    /**
     * Xumm xApp SDK: UI lib.
     */
    const xapp = _classes?.xApp;
    if (xapp) this.xapp = xapp;
  }

  /**
   * PKCE
   */
  public async authorize(): Promise<ResolvedFlow | undefined> {
    // console.log("Authorize");
    return _classes?.XummPkce?.authorize();
  }

  public async logout() {
    Object.assign(_classes, { XummSdkJwt: undefined });
    return _classes?.XummPkce?.logout();
  }

  /**
   * SDK
   */
  public async ping(): Promise<ReturnType<XummSdk["ping"]> | undefined> {
    // TODO: What if not JWT but regular?
    await Promise.all(readyPromises);
    return (_classes?.XummSdkJwt || _classes?.XummSdk)?.ping();
  }
}
