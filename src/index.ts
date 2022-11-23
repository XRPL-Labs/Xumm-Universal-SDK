import type { XummSdk, XummSdkJwt } from "xumm-sdk";
import type { XummPkce } from "xumm-oauth2-pkce";
import type { xApp } from "xumm-xapp-sdk";
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
  XummSdk?: typeof XummSdk;
  XummSdkJwt?: typeof XummSdkJwt;
  XummPkce?: typeof XummPkce;
  xApp?: typeof xApp;
}

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

console.log(runtime);

export class Xumm extends EventEmitter {
  constructor(apiKeyOrJwt: string, apiSecretOrOtt?: string) {
    super();

    if (runtime.indexOf("cli") > -1) {
      if (!_classes?.XummSdk) {
        Object.assign(_classes, {
          XummSdk: new (require("xumm-sdk").XummSdk)(
            apiKeyOrJwt,
            apiSecretOrOtt
          ),
        });
      }
      if (!_classes?.XummSdkJwt) {
        Object.assign(_classes, {
          // XummSdkJwt: new XummSdkJwt(apiKeyOrJwt, apiSecretOrOtt),
        });
      }
    }

    if (runtime.indexOf("browser") > -1) {
      if (!_classes?.XummSdk) {
        Object.assign(_classes, {
          XummSdk: new (require("xumm-sdk").XummSdk)(
            apiKeyOrJwt,
            apiSecretOrOtt
          ),
        });
      }
      if (!_classes?.XummSdkJwt) {
        Object.assign(_classes, {
          XummSdkJwt: new (require("xumm-sdk").XummSdkJwt)(
            apiKeyOrJwt,
            apiSecretOrOtt
          ),
        });
      }
      if (!_classes?.XummPkce) {
        Object.assign(_classes, {
          XummPkce: new (require("xumm-oauth2-pkce").XummPkce)(
            apiKeyOrJwt,
            apiSecretOrOtt
          ),
        });
      }
    }

    if (runtime.indexOf("xapp") > -1) {
      if (!_classes?.xApp) {
        Object.assign(_classes, {
          xApp: new (require("xumm-xapp-sdk").xApp)(),
        });
      }
    }

    setTimeout(() => {
      console.log(_classes);
    }, 1000);
  }
}
