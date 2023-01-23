# Xumm (Universal SDK)

One SDK for frontend (browser), backend (node/ts) & xApp (SDK & frontend interaction).

Documentation: https://xumm.readme.io/v1.0/docs/sdk-intro-npm-cdn

### `{BETA}` Warning! This is very much a work in progress!

# Some notes

- This SDK lives on NPM (beta) as `xumm`: [package/xumm](https://www.npmjs.com/package/xumm).
- This pacakge is suitable for npm (node module) use, and also ships browserified.
- The CDN location for this pacakge for VannilaJS use: [here](https://xumm.app/assets/cdn/xumm.min.js).
- This package incorporates three existing SDKs, so their syntax will be similar (on object properties yielded by this SDK):
  - `xumm-sdk` ([npm](https://www.npmjs.com/package/xumm-sdk)) for Xumm API/Backend/JWT interaction
  - `xumm-oauth2-pkce` ([npm](https://www.npmjs.com/package/xumm-oauth2-pkce)) for Web2/Web3 client side sign in
  - `xumm-xapp-sdk` ([npm](https://www.npmjs.com/package/xumm-xapp-sdk)) for Xumm UI interaction for xApps
- All objects and properties returned by this SDK are Promises, as everything is async based on end user sign in or session retrieval.
- Some functionality relies on events. This SDK extends the EventEmitter interface.

# Object (construct)

The `Xumm` SDK is constructed with:

- The public app key as obtained from our developer console at https://apps.xumm.dev
- or: a JWT previously issued by our platform

So to construct:

```
const xumm = new Xumm('some-api-key')
```

All interactions using just the API key will be device locked, based on the device that signs in. This means you can only access payloads created by the same device that signed in.

Only when running in a fully backend (server side) setup, you can auth. using the public API key and the secret key (as obtained from our developer console):

```
const xumm = new Xumm('some-api-key', 'some-secret-key')
```

All interactions constructed server side like above (using the API key and the secret key) are global, and can access all payloads created.

# Object (format)

The constructed object looks like this:

```
Xumm = {
  // Where are we running? xApp? Web? Backend? (Xumm Universal SDK specific)
  runtime: {
    cli: boolean
    browser: boolean
    xapp: boolean
  }

  // Information about the user & user credentials (Xumm Universal SDK specific)
  user: {
    account: string
    picture: string
    name: string
    domain: string
    source: string
    networkType: string
    networkEndpoint: string
    blocked: boolean
    kycApproved: boolean
    proSubscription: boolean
  }

  // Payload helpers, to ask the user to sign something & retrieve results, from `xumm-sdk`
  // https://github.com/XRPL-Labs/XUMM-SDK#payloads
  payload?: Payload

  // xApp UI interaction, from `xumm-xapp-sdk`
  // https://xumm.readme.io/v0.9/docs/xapp-xumm-ui-interaction
  xapp?: xApp

  // Persistent user key/value store, from `xumm-sdk`
  // https://github.com/XRPL-Labs/XUMM-SDK/blob/master/src/types/JwtUserdata.ts
  userstore?: JwtUserdata

  // App specific object store, for app context info (backend only), from `xumm-sdk`
  backendstore?: {
    get() // Get stored object
    set(json) // Set (store) object
    delete() // Delete stored object
  }

  // Helper methods, from `xumm-sdk`
  helpers?: {
    ping()
    getCuratedAssets()
    getRates()
    getKycStatus(subject)
    getTransaction(subject)
    verifyUserTokens(subjects)
  }

  // Send push notifications to users (permissioned), from `xumm-sdk`
  push?: Push

  // Web2/Web3 sign in, from `xumm-oauth2-pkce`:
  authorize()
  logout()

  // Check authorization, from `xumm-sdk`
  ping()

  // Credentials / information about the runtime (Xumm Universal SDK specific)
  // Please consider using the unified `user` prop (above)
  environment: {
    ott?: {
      locale?: string
      version?: string
      account?: string
      accountaccess?: string
      accounttype?: string
      style?: string
      origin?: xAppOrigin
      user: string
      user_device?: {
        currency: string
        platform: string
      }
      account_info: {
        account: string
        name?: string
        domain?: string
        blocked: boolean
        source: string
        kycApproved: boolean
        proSubscription: boolean
      }
      nodetype?: string
      currency?: string
      subscriptions?: string[]
    }
    jwt?: {
      client_id: string
      scope?: string
      state?: string
      aud: string
      sub: string
      email?: string
      app_uuidv4: string
      app_name: string
      payload_uuidv4?: string
      usertoken_uuidv4?: string
      network_type?: string
      network_endpoint?: string
      iat: number
      exp: number
      iss: string
      usr?: string
      net?: string
      [key: string]: any
    }
    openid?: {
      sub: string
      email: string
      picture: string
      account: string
      name: string
      domain?: string
      blocked: boolean
      source?: string
      kycApproved: boolean
      proSubscription: boolean
      networkType: string
      networkEndpoint: string
    }
    bearer?: string
  }
}
```
