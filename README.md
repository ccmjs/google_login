# Google Login

Standalone ccmjs authentication using Google as the only login method. After Google
sign-in, the component exchanges the proof at a CCM server and manages the returned
CCM JWT. Apps can use it directly as `config.user`, without the User component.
No build step or package installation is needed.

## Usage

```javascript
user: ["ccm.instance", "https://ccmjs.github.io/google_login/ccm.google_login.mjs", {
  server: "https://YOUR_CCM_SERVER",
  clientId: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  realm: "ccm",
  url: "https://ccmjs.github.io/google_login/auth.html",
  displayName: "name",
  picture: true,
}],
```

An app calls `await this.user.login()`, reads `getState()` and `getToken()`, and signs
out with `await this.user.logout()`. The view displays the Google button while signed
out and the display name, optional picture and sign-out button while signed in.
There is no local username/password login or registration.

`server` is the CCM API URL (default `http://localhost:8080`), `realm` selects the user
area, and `url` points to the Google popup. The server must have the Google OAuth
client ID configured and support Google's token exchange. It verifies the signature,
issuer, audience and expiry; the browser never treats decoded Google claims as a
verified CCM identity. The embedding webpage never redirects.

`displayName`: `name` (default), `given_name`, `family_name`, `email` or `id`.
`id` selects Google's subject (`sub`); missing names fall back to it on the server.
`picture: false` omits the profile image. These settings apply on the next login and
do not filter Google's original ID token. `labels` and `labels.popup` configure text.

With `session: true` (default), only the CCM token and public metadata are saved in
sessionStorage, separated by server and realm. The Google proof is discarded after
exchange. Restored metadata is provisional; the server checks the token on the next
request. Storage failures do not prevent login. Logout clears local state and saved
session; it neither signs out of Google nor revokes an already issued JWT.

## Public interface

| Method | Purpose |
| --- | --- |
| `start()` | Render without resetting a session or active login |
| `login()` | Return CCM metadata; concurrent calls share the active promise |
| `logout()` | Discard the CCM session and cancel pending authentication |
| `isLoggedIn()` | Whether a CCM session is held |
| `getState()` | Copy of `{ key, user, realm, provider, picture? }`, or `null` |
| `getToken()` | CCM JWT, or `null` |
| `getSessionOwner()` | This instance, for datastore retry coordination |
| `cancel()` | Cancel pending work without removing an established session |
| `getProvider()` | `google` |
| `setDisabled(boolean)` | Prevent new login attempts |
| `emit(type)` | Dispatch to configured extensions sequentially |

Each instance owns its session. Independent instances do not synchronize live changes.
The framework can retry an expired session through logout/login without restarting the
app. A browser may block a popup opened without a user gesture; the user can sign in
using the rendered button and retry the action.

## Events and reuse in the User component

Extensions receive `{ app, type }`: `init`, `ready`, `start`, `before-login`, `login`,
`logout`, `cancel`, `error`, `finish`. `login` fires after the CCM
server accepts the session. Extension errors stop dispatch and reject the caller;
a session already accepted is not rolled back. `finish` follows a completed active
attempt. Explicit cancellation clears the attempt immediately and emits `cancel`.

When embedded in the User component's `providers` array, this component still owns
its session and performs the only token exchange. The User component selects it
on `login` and delegates `getState()`, `getToken()`, `isLoggedIn()` and `logout()`.
It retains the selected provider for re-login after token expiry. No credentials,
JWTs or metadata are copied into the User component's own saved session.
Configure the provider's server and realm for the data the app accesses.
The component has one operating mode; `server: false` is not supported.

## Demo and files

Serve the repository over HTTP and open `index.html`, which starts the component with its default configuration. Start a configured CCM server
on port 8080. The default configuration uses `https://ccmjs.github.io/google_login/auth.html`; publish
the callback and its resources first. For local popup testing, configure `url` to
`http://localhost:8000/auth.html` and register that origin with Google.

Resource URL strings must resolve to this repository when embedded elsewhere; override
relative dependencies with hosted URLs if your embedding setup does not resolve them
relative to the component. Set the public client ID through `config.clientId`; the default is defined in the component.
Never put a client secret in browser files.

- `ccm.google_login.mjs`: configuration, lifecycle, session and login orchestration.
- `resources/`: views, CSS and popup page logic.
- `auth.html`: minimal callback entry point; markup comes from `resources/views.mjs`.
- `resources/auth.mjs`: logic running inside the popup. Opener communication is a private helper in the component.
- `libs/`: bundled framework and UI helper.

Run `node --test test/*.test.mjs`.
See the Google setup instructions below.

## Google setup

1. Create an OAuth client of type **Web application** in Google Cloud Console.
2. Register the callback page's origin under **Authorized JavaScript origins**,
   for example `https://ccmjs.github.io`. For a local callback add the exact origin,
   such as `http://localhost:8000`.
3. Set the public client ID in the component configuration as `clientId`. A client secret is neither needed
   nor permitted in these browser files.
4. Publish `auth.html` at the repository root together with the `resources/` directory.
   `resources/auth.mjs` loads the popup view from that directory and receives the client ID from the opener.
5. Configure the component's `url` to point at `https://ccmjs.github.io/google_login/auth.html`.

The component defaults to its own callback page. The default configuration uses `https://ccmjs.github.io/google_login/auth.html`; publish this repository
through GitHub Pages before using it.
A shared GitHub Pages origin does not require another Google origin registration just
because the repository path changes. The embedding website can have a different origin.

The popup exchanges messages only with its opener and the expected origin and request
identifier. The main page is not redirected. Google may open its own account-selection
window. Popup blocking or restrictive browser policies can prevent this flow.

The Google callback returns an ID token, not a CCM token. A consuming backend must
verify it using the configured client ID. The CCM server already supports this exchange
via `{ login: "google", credentials, realm }`.

All visible component labels are in `config.labels`; popup labels are nested under
`config.labels.popup`. The popup receives them through the validated message handshake.
Before that handshake only fallback error/status text is available.

Official documentation:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

The popup receives `clientId` with the labels through the validated opener handshake.
Register the popup origin for that OAuth client, and configure the same client ID
on the CCM server for token verification. The client ID is public, not a client secret.
