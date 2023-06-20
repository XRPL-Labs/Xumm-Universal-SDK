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
import type {
  XummPkceEvent,
  ResolvedFlow,
  XummProfile,
} from "xumm-oauth2-pkce";
import type {
  xApp,
  xAppEvent,
  qrEventData,
  payloadEventData,
  destinationEventData,
} from "xumm-xapp-sdk";

import { EventEmitter } from "events";

export interface UniversalSdkEvent {
  logout: () => void;
  ready: () => void;
  retrieving: () => void;
}

const fromBinary = (encoded: string) => {
  // Fix browser atob UTF8 incompat
  return Buffer.from(encoded, "base64").toString("base64");
};

/**
 * Development?
 *   npm run watch (tsc in watch mode)
 *   npm run browserify-watch (watch, browserify tsc output)
 *   npm run serve (webserver, :3001)
 *   npm run dev (watch, nodemon dist/samples/index.js)
 *   ngrok start dev (local :3001 to https:// dev URL)
 *     > https://.../sample/
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
  on<U extends keyof UniversalSdkEvent>(
    event: U,
    listener: UniversalSdkEvent[U]
  ): this;
  on<U extends keyof xAppEvent>(event: U, listener: xAppEvent[U]): this;
  on<U extends keyof XummPkceEvent>(event: U, listener: XummPkceEvent[U]): this;
  off<U extends keyof UniversalSdkEvent>(
    event: U,
    listener: UniversalSdkEvent[U]
  ): this;
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
        profile?: XummProfile;
        [key: string]: any;
      }
    | undefined
  >;
  bearer?: Promise<string>;
  retrieving: Promise<void>;
  ready: Promise<void>;
  success: Promise<void>;
  retrieved: Promise<void>;
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
  public profile = Asyncify<XummProfile | undefined>(
    () =>
      _me?.profile ??
      (_ott?.account_info?.profile?.slug
        ? (_ott.account_info.profile as XummProfile)
        : undefined)
  );
  public token = Asyncify<string | null>(
    () => _jwtData?.usertoken_uuidv4 ?? null
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
      | "getNftokenDetail"
    >
  >;
  public push?: Promisified<Push>;

  private apiKeyOrJwt: string = "";
  private apiSecretOrOtt?: string;

  constructor(apiKeyOrJwt: string, apiSecretOrOtt?: string) {
    super();

    this.apiKeyOrJwt = apiKeyOrJwt;
    this.apiSecretOrOtt = apiSecretOrOtt;

    instance++;
    this.instance = String(instance);

    if (typeof console?.log !== "undefined") {
      if (!_runtime.cli) console.log("Constructed Xumm", { runtime });
    }

    let jwtExpired = false;
    if (
      typeof this.apiKeyOrJwt === "string" &&
      this.apiKeyOrJwt.split(".").length === 3
    ) {
      let _testJwtData;
      try {
        // Check validity
        _testJwtData = JSON.parse(fromBinary(this.apiKeyOrJwt.split(".")?.[1]));
      } catch (e) {
        // e
        // Parse error
      }

      if (Date.now() >= _testJwtData.exp * 1000) {
        jwtExpired = true;
        const appId =
          _testJwtData?.app_uuidv4 ??
          _testJwtData?.client_id ??
          _testJwtData?.aud ??
          "";
        this.apiKeyOrJwt = appId;
        if (!_runtime.cli)
          console.log("JWT expired, falling back to API KEY: " + appId);
        if (_runtime.cli || _runtime.xapp) {
          const error = new Error(
            "JWT Expired, cannot fall back to API credential: in CLI/xApp environment"
          );
          this.emit("error", error);
          throw error;
        }
      }

      if (!jwtExpired) {
        this.jwtCredential = true;
        _jwt = this.apiKeyOrJwt;
      }
    }

    this.initialize();

    /**
     * Bootstrap class properties
     */
    this.user = new UnifiedUserData();
    this.environment = {
      jwt: Asyncify(() => _jwtData) as Environment["jwt"],
      ott: Asyncify(() => _ott),
      openid: Asyncify(() => _me) as Environment["openid"],
      bearer: Asyncify(() => _jwt),
      ready: new Promise((resolve) =>
        this.on("ready", () => resolve(undefined))
      ),
      success: new Promise((resolve) =>
        this.on("success", () => resolve(undefined))
      ),
      retrieved: new Promise((resolve) =>
        this.on("retrieved", () => resolve(undefined))
      ),
      retrieving: new Promise((resolve) =>
        this.on("retrieving", () => resolve(undefined))
      ),
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

    setTimeout(
      () =>
        Promise.all([
          ...readyPromises.filter(
            (p) =>
              (p as Record<string, any>)?.promiseType !==
              "pkceRetrieverResolver"
          ),
          /**
           * If PKCE flow: wait for `ready` till account is known
           */
          _runtime.xapp
            ? Promise.resolve()
            : new Promise((resolve: any) => {
                if (_classes?.XummPkce) {
                  this.user.account.then(() => resolve());
                  _classes.XummPkce?.on("loggedout", () => resolve());
                } else {
                  resolve();
                }
              }),
        ]).then(() => this.emit("ready")), // Constructor ready
      0
    );
  }

  private initialize(): void {
    _ott = undefined;

    if (
      typeof this.apiKeyOrJwt === "string" &&
      this.apiKeyOrJwt.split(".").length === 3 &&
      _jwt === this.apiKeyOrJwt
    ) {
      // Keep JWT data, constructed with JWT
    } else {
      _jwt = "";
      _jwtData = {};
    }
    _me = {};
    _initialized.XummSdkJwt = false;
    // _initialized.XummPkce = false

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

    this.handlePkceEvents();

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

          // Mock, so browser code works in xApp as well
          this.emit("retrieved");
          this.emit("success");
        }

        if (jwt) {
          _jwt = jwt;
          try {
            _jwtData = JSON.parse(fromBinary(_jwt.split(".")?.[1]));

            if (doNotFetchJwtOtt && this.jwtCredential) {
              // Mock, so success & retrieved events are fired as well.
              setTimeout(() => this.emit("retrieved"), 0);
              setTimeout(() => this.emit("success"), 0);
            }
          } catch (e) {
            if (typeof console?.log !== "undefined") {
              if (!_runtime.cli)
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
          XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(
            this.apiKeyOrJwt,
            // Get OTT from UA if present, otherwise fall back to default behaviour
            typeof _classes?.xApp?.getEnvironment !== "undefined"
              ? _classes?.xApp?.getEnvironment()?.ott || undefined // Required as null breaks
              : undefined
          ),
        });

        readyPromises.push(handleOttJwt());
      }
    };

    if (_runtime.xapp) {
      /**
       * xApp
       */
      if (
        typeof this.apiKeyOrJwt !== "string" ||
        !(uuidv4re.test(this.apiKeyOrJwt) || this.jwtCredential)
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
        typeof this.apiKeyOrJwt !== "string" ||
        !(uuidv4re.test(this.apiKeyOrJwt) || this.jwtCredential)
      ) {
        throw new Error(
          "Running in browser, constructor requires first param. to be Xumm API Key or JWT"
        );
      }

      if (!_classes?.XummPkce && !_runtime.xapp) {
        Object.assign(_classes, {
          XummPkce: new XummPkce(this.apiKeyOrJwt, {
            implicit: true,
          }),
        });

        if (_classes.XummPkce) {
          if (this.jwtCredential) {
            initOttJwtRuntime();
          } else {
            setTimeout(() => this.emit("retrieving"), 0);
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

            readyPromises.push(this.handlePkceEvents());
            // The promise below does not count against the "ready" event
            const pkceRetrieverResolver = new Promise(
              (resolve: (value: ResolvedFlow | undefined) => void) => {
                _classes.XummPkce?.on("retrieved", () => {
                  handlePkceState(resolve);
                });
                _classes.XummPkce?.on("success", () => {
                  handlePkceState(resolve);
                });
              }
            );

            readyPromises.push(
              Object.assign(pkceRetrieverResolver, {
                promiseType: "pkceRetrieverResolver",
              })
            );
          }
        }
      }
    } else if (_runtime.cli) {
      /**
       * CLI, Node / ...
       */
      if (typeof this.apiKeyOrJwt !== "string") {
        throw new Error(
          "Running CLI, constructor needs first param. to be Xumm API Key / raw JWT"
        );
      } else {
        if (uuidv4re.test(this.apiKeyOrJwt)) {
          // API Key
          if (
            typeof this.apiSecretOrOtt !== "string" ||
            !uuidv4re.test(this.apiSecretOrOtt)
          ) {
            throw new Error(
              "Running CLI, constructor first param. is API Key, but second param. isn't a valid API Secret"
            );
          }
        }
        if (
          !uuidv4re.test(this.apiKeyOrJwt) &&
          this.apiKeyOrJwt.split(".").length !== 3
        ) {
          throw new Error(
            "Running CLI, constructor first param. not a valid JWT, nor a valid API Key"
          );
        }

        // All fine
        if (this.jwtCredential) {
          initOttJwtRuntime();
        } else {
          if (!_classes?.XummSdk) {
            Object.assign(_classes, {
              XummSdk: new (require("xumm-sdk").XummSdk)(
                this.apiKeyOrJwt,
                this.apiSecretOrOtt
              ),
            });
          }
        }
      }
    }
  }

  /**
   * PKCE
   */
  public async authorize(): Promise<ResolvedFlow | undefined | Error> {
    // console.log("Authorize");
    try {
      return await _classes?.XummPkce?.authorize();
    } catch (e) {
      return e as Error;
    }
  }

  /**
   * TODO: CHECK IF EVENTS ARE NOT REGISTERED AND FIRING TWICE
   */

  private async handlePkceEvents() {
    // Always attach event listeners
    // So no:  && !_initialized.XummPkce
    if (_classes?.XummPkce && !_initialized.XummPkce) {
      _initialized.XummPkce = true;

      const retrievedHandler = () => this.emit("retrieved");
      const successHandler = () => this.emit("success");
      const errorHandler = (data: Error) => this.emit("error", data);

      _classes.XummPkce.on("retrieved", retrievedHandler);
      _classes.XummPkce.on("success", successHandler);
      _classes.XummPkce.on("error", errorHandler);
    }

    return;
  }

  public async logout() {
    if (_runtime.xapp) {
      return;
    }

    let downgradeJwtLogin = false;

    if (
      typeof this.apiKeyOrJwt === "string" &&
      this.apiKeyOrJwt.split(".").length === 3 &&
      _jwtData?.app_uuidv4 &&
      this.jwtCredential
    ) {
      // Constructed with JWT, reset to application UUID for new auth
      this.apiKeyOrJwt = _jwtData.app_uuidv4;
      this.jwtCredential = false;
      downgradeJwtLogin = true;
      // Remove PKCE Thread for full re-init
      (window as any)._XummPkce = undefined;
    }

    if (_runtime.browser && (_me?.sub || downgradeJwtLogin)) {
      _classes?.XummPkce?.logout();

      Object.assign(_classes, {
        XummSdk: undefined,
        XummSdkJwt: undefined,
        XummPkce: undefined,
      });

      readyPromises.length = 0;
      this.jwtCredential = false;

      this.initialize();

      /**
       * RESET: Bootstrap class properties
       */
      this.user = new UnifiedUserData();
      this.environment = {
        jwt: Asyncify(() => _jwtData) as Environment["jwt"],
        ott: Asyncify(() => _ott),
        openid: Asyncify(() => _me) as Environment["openid"],
        bearer: Asyncify(() => _jwt),
        ready: new Promise((resolve) =>
          this.on("ready", () => resolve(undefined))
        ),
        success: new Promise((resolve) =>
          this.on("success", () => resolve(undefined))
        ),
        retrieved: new Promise((resolve) =>
          this.on("retrieved", () => resolve(undefined))
        ),
        retrieving: new Promise((resolve) =>
          this.on("retrieving", () => resolve(undefined))
        ),
      };

      this.emit("logout");
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
}
