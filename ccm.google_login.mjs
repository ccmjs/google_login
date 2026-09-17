/**
 * Google sign-in with an independent CCM session.
 * The popup supplies a Google proof; only the CCM server verifies it and issues the session JWT.
 *
 * @author André Kless <andre.kless@web.de>
 * @copyright 2026 André Kless
 * @license MIT
 */
export const component = {
  name: "google_login",
  ccm: "././libs/framework/ccm.js",
  config: {
    /** Public Google OAuth Web client ID; the CCM server must trust the same client. */
    clientId: "90855209934-9vas1fscpkefmglhfou7lut1uhv62ear.apps.googleusercontent.com",
    /** Hosted callback page whose origin is registered with Google. */
    url: "././auth.html",
    /** CCM server API used to exchange the Google proof for a session. */
    server: "http://localhost:8080",
    /** Independent account area and saved-session namespace. */
    realm: "ccm",
    /** Preserve the CCM session in this tab across reloads. */
    session: true,
    /** Verified Google field used as display name: name, given_name, family_name, email or id (Google subject). */
    displayName: "name",
    /** Whether the CCM session should include Google's profile picture URL. */
    picture: true,
    /** UI utilities for HTML templates, rendering and DOM event binding. */
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],
    /** Templates for the login button and signed-in account view. */
    views: ["ccm.load", "././resources/views.mjs"],
    /** Styles for this component instance; the hosted popup uses its own stylesheet. */
    css: ["ccm.load", "././resources/styles.css"],
    /** Event handlers receiving { app, type }, awaited sequentially in configuration order. */
    extensions: [],
    /** Configurable interface text and error messages. */
    labels: {
      /** Text of the Google sign-in button. */
      button: "Sign in with Google",
      /** Text of the local sign-out button. */
      logout: "Sign out",
      /** Error when the CCM response has invalid metadata or a missing token. */
      invalidResponse: "The server returned an invalid authentication response.",
      /** Error when login is requested while the component is disabled. */
      disabled: "Login is currently unavailable.",
      /** Visible fallback message when authentication fails. */
      failed: "Google sign-in failed. Please try again.",
      /** Error when the browser prevents opening the popup. */
      popupBlocked: "Please allow the login popup and try again.",
      /** Error when the popup does not complete within the time limit. */
      timeout: "Google sign-in timed out. Please try again.",
      /** Message of the AbortError returned when login is cancelled. */
      cancelled: "Login cancelled.",
      /** Labels sent to the hosted popup through the opener handshake. */
      popup: {
        /** Language code for the popup document and Google button. */
        language: "en",
        /** Popup window title. */
        title: "Sign in with Google",
        /** Text displayed before the requesting website origin. */
        heading: "Sign in for",
        /** Text of the button for retrying the Google script load. */
        retry: "Try again",
        /** Status while loading the Google sign-in library. */
        loading: "Loading Google sign-in …",
        /** Status after sending the Google proof back to the opener. */
        transferring: "Returning sign-in to the website …",
        /** Error when the Google sign-in library cannot be loaded. */
        loadFailed: "Google could not be loaded. Please try again.",
        /** Error for a disallowed requesting website URL. */
        invalidURL: "An HTTPS address is required (HTTP is allowed locally).",
        /** Error when the popup request or initialization message is invalid. */
        invalidRequest: "Please open this page using the user component's Google button.",
        /** Error when the opener supplies no usable Google client ID. */
        missingClientId: "The Google client ID is missing in the component configuration.",
      },
    },
  },
  Instance: function () {
    /** Temporary interface state; no credentials are stored in GUI state. */
    this.gui = {
      /** Whether popup authentication, the server exchange or its event handlers are still running. */
      busy: false,
      /** Whether the embedding application currently prevents a new login. */
      disabled: false,
      /** Error displayed below the button. */
      message: "",
    };

    /**
     * Public metadata is returned only as a copy; the CCM JWT stays separate.
     * @type {UserIdentity|null}
     */
    let state = null;
    /** CCM authentication token, never the Google ID token. */
    let token = null;
    /**
     * Active attempt. Clearing this reference invalidates its later popup or server responses.
     * Its promise initially represents the popup, then the complete login including the server exchange.
     */
    let pending = null;

    /** Normalizes the server URL before session storage is accessed. */
    this.init = async () => {
      // Equivalent server URLs must use the same storage key; invalid absolute URLs fail early.
      this.server = new URL(this.server).href;
      await this.emit("init");
    };

    /** Restores a saved CCM session before notifying ready extensions. */
    this.ready = async () => {
      const saved = storage("getItem");
      if (saved) {
        try {
          // Restore locally; token expiry is checked by the server on the next authenticated request.
          const session = JSON.parse(saved);
          if (validSession(session)) acceptSession(session);
          else storage("removeItem");
        } catch { storage("removeItem"); }
      }
      await this.emit("ready");
    };

    /** Renders the login or account view without resetting the session or an active attempt. */
    this.start = async () => {
      render();
      await this.emit("start");
    };

    /** Identifies the authentication provider for a consuming application. */
    this.getProvider = () => "google";

    /**
     * Returns a copy so consumers cannot change the private user metadata.
     * @returns {UserIdentity|null} Current metadata, or null when signed out
     */
    this.getState = () => state && { ...state };

    /**
     * Returns the CCM JWT for authenticated datastore requests, never the Google proof.
     * @returns {string|null} Token, or null when signed out
     */
    this.getToken = () => token;

    /** Reports whether a CCM token is held; this does not check its expiry or server-side validity. */
    this.isLoggedIn = () => token !== null;

    /** Identifies this instance as the owner of its session for shared datastore retries. */
    this.getSessionOwner = () => this;

    /** Discards the local CCM session and cancels pending authentication without signing out of Google. */
    this.logout = async () => {
      const changed = token !== null;
      // Clear local data before awaiting extensions; logout does not revoke an already issued JWT.
      token = null;
      state = null;
      storage("removeItem");
      await this.cancel();
      if (changed) await this.emit("logout");
    };

    /**
     * Enables or disables new logins without interrupting an active popup or clearing a session.
     * @param {boolean} disabled - Whether the embedding application currently prevents login
     */
    this.setDisabled = (disabled) => {
      this.gui.disabled = !!disabled;
      render();
    };

    /**
     * Obtains a Google proof, exchanges it for a CCM session, then notifies login extensions.
     * Repeated calls share the pending promise; an existing session is returned immediately.
     * @returns {Promise<UserIdentity>} CCM user metadata after login extensions complete
     */
    this.login = () => {
      if (pending) return pending.promise;
      if (token) return Promise.resolve(this.getState());
      if (this.gui.disabled) return Promise.reject(new Error(this.labels.disabled));
      this.gui.message = "";
      this.gui.busy = true;
      // Open before awaiting extensions so a button click retains popup permission.
      const operation = openPopup();
      pending = operation;
      render();
      // Callers wait for the whole login, not just the Google popup response.
      operation.promise = completeLogin(operation, operation.promise);
      return operation.promise;
    };

    /** Cancels an active attempt while preserving any established CCM session and the Google login. */
    this.cancel = async () => {
      const operation = pending;
      // Invalidate first so a late response cannot establish a session after cancellation.
      pending = null;
      this.gui.busy = false;
      this.gui.message = "";
      operation?.cancel();
      render();
      await this.emit("cancel");
    };

    /** DOM event handlers bound by ccm-ui. */
    this.events = {
      /** Starts sign-in; failures are shown by the component. */
      login: () => this.login().catch(() => {}),
      /** Ends only this application's session. */
      logout: () => this.logout().catch(console.error),
    };

    /**
     * Dispatches events sequentially; an extension error stops dispatch and rejects the caller.
     * @param {string} type - init, ready, start, before-login, login, logout, cancel, error or finish
     * @returns {Promise<void>} Completes after the configured extensions
     */
    this.emit = async (type) => {
      const extensions = [].concat(this.extensions || []);
      for (const extension of extensions) if (extension) await extension({ app: this, type });
    };

    /** Updates only this instance's view. */
    const render = () => this.ui.render(this.views.main(this), this.element, this);

    /**
     * Accesses this component's saved CCM session, tolerating unavailable browser storage.
     * @param {"getItem"|"setItem"|"removeItem"} method - Storage operation
     * @param {string} [value] - Serialized session for setItem
     * @returns {string|null} Stored value, or null
     */
    const storage = (method, value) => {
      if (!this.session) return null;
      try {
        const key = `ccm-google-session:${JSON.stringify([this.server, this.realm])}`;
        return sessionStorage[method](key, value) ?? null;
      } catch { return null; }
    };

    /**
     * Checks metadata and token format, not the JWT signature or expiry.
     * @param {unknown} value - Server response or parsed session storage entry
     * @returns {boolean|null|undefined} Truthy only for a Google session in the configured realm
     */
    const validSession = value => value && this.ccm.helper.isKey(value.key) && typeof value.key === "string" &&
      typeof value.user === "string" && value.realm === this.realm && value.provider === "google" &&
      typeof value.token === "string" && !!value.token;

    /**
     * Copies an already validated session into private state, excluding unexpected response fields.
     * @param {UserIdentity & {token: string}} session - Validated server response or saved session
     */
    const acceptSession = session => {
      token = session.token;
      state = { key: session.key, user: session.user, realm: session.realm, provider: session.provider };
      if (this.picture && typeof session.picture === "string" && session.picture.startsWith("https://"))
        state.picture = session.picture;
    };

    /**
     * Opens the hosted page and receives a Google proof through its message handshake.
     * @returns {{promise: Promise<{idToken: string}>, cancel: function(): void}} Popup result and cleanup action
     */
    const openPopup = () => {
      const { labels } = this;
      const url = new URL(this.url || "./auth.html", import.meta.url);
      // Bind replies to this attempt, even when several instances use the same hosted page.
      const request = crypto.randomUUID();
      url.hash = new URLSearchParams({ origin: location.origin, request }).toString();
      const popup = window.open(url.href, "_blank", "popup,width=520,height=680");
      if (!popup) return { promise: Promise.reject(new Error(labels.popupBlocked)), cancel() {} };
      /** Assigned inside the promise so external cancellation uses the same cleanup path. */
      let cancel;
      const promise = new Promise((resolve, reject) => {
        let finished = false;
        /** Settles once and releases all resources on success, failure, timeout or cancellation. */
        const finish = (error, credential) => {
          if (finished) return;
          finished = true;
          window.removeEventListener("message", receive);
          clearInterval(closed);
          clearTimeout(timeout);
          popup.close();
          error ? reject(error) : resolve(credential);
        };
        /** Ignores unrelated windows, origins and attempts before handling a popup message. */
        const receive = event => {
          if (event.origin !== url.origin || event.source !== popup || event.data?.request !== request) return;
          if (event.data.type === "ccm-google-ready") {
            // Send configuration only after the expected popup announces it is ready.
            popup.postMessage({ type: "ccm-google-init", request, clientId: this.clientId, labels: labels.popup }, url.origin);
          } else if (event.data.type === "ccm-google-result" && typeof event.data.idToken === "string") {
            finish(null, { idToken: event.data.idToken });
          }
        };
        window.addEventListener("message", receive);
        // Closing the popup manually does not send a message, so detect it by polling.
        const closed = setInterval(() => {
          if (popup.closed) finish(new DOMException(labels.cancelled, "AbortError"));
        }, 500);
        // Bound the waiting period if the popup stays open without returning a result.
        const timeout = setTimeout(() => finish(new Error(labels.timeout)), 5 * 60 * 1000);
        cancel = () => finish(new DOMException(labels.cancelled, "AbortError"));
      });
      return { promise, cancel: () => cancel() };
    };

    /**
     * Exchanges one popup result for a CCM session and runs the corresponding event handlers.
     * @param {Object} operation - Attempt object compared with pending after asynchronous steps
     * @param {Promise<{idToken: string}>} result - Original popup promise, before it is replaced
     * @returns {Promise<UserIdentity>} Metadata after successful authentication and login extensions
     */
    const completeLogin = async (operation, result) => {
      // Observe popup rejection immediately, even while an extension is still processing before-login.
      const outcome = result.then(value => ({ value }), error => ({ error }));
      try {
        await this.emit("before-login");
        const { value, error } = await outcome;
        if (pending !== operation) throw new DOMException(this.labels.cancelled, "AbortError");
        if (error) throw error;
        if (typeof value?.idToken !== "string" || !value.idToken) throw new Error(this.labels.failed);
        // The Google proof is used only for this request; the server chooses the verified identity.
        const credential = { idToken: value.idToken, displayName: this.displayName, picture: this.picture };
        const session = await this.ccm.load({
          url: this.server, method: "POST",
          params: { login: "google", credentials: credential, realm: this.realm },
        });
        // Logout or cancellation can happen while the server is still responding.
        if (pending !== operation) throw new DOMException(this.labels.cancelled, "AbortError");
        if (!validSession(session)) throw new Error(this.labels.invalidResponse);
        acceptSession(session);
        // Persist only the CCM token and metadata, never the Google proof.
        storage("setItem", JSON.stringify({ token, ...state }));
        // Consumers can now read the accepted CCM session through the public getters.
        await this.emit("login");
        if (pending !== operation) throw new DOMException(this.labels.cancelled, "AbortError");
        return this.getState();
      } catch (error) {
        if (pending === operation) {
          // Extension failures do not undo a session already accepted by the server.
          if (!token) this.gui.message = error.name === "AbortError" ? "" : this.labels.failed;
          await this.emit(error.name === "AbortError" ? "cancel" : "error");
        }
        throw error;
      } finally {
        // Also release the popup when an extension or the server exchange fails.
        operation.cancel();
        // A cancelled attempt must not reset the interface of a newer login.
        if (pending === operation) {
          pending = null;
          this.gui.busy = false;
          render();
          await this.emit("finish");
        }
      }
    };
  },
};

/**
 * Public CCM user metadata; tokens are deliberately excluded.
 * @typedef {Object} UserIdentity
 * @property {string} key - CCM account key within the realm, not Google's subject
 * @property {string} user - Display name selected by the CCM server
 * @property {string} realm - Independent account area on the CCM server
 * @property {"google"} provider - Authentication provider
 * @property {string} [picture] - Optional HTTPS profile picture URL
 */
