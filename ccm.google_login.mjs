export const component = {
  name: "google_login",
  ccm: "././libs/framework/ccm.js",
  config: {
    /** Hosted callback page whose origin is registered with Google. */
    url: "././auth.html",
    /** CCM server API used to exchange the Google proof for a session. */
    server: "http://localhost:8080",
    /** Independent account area and saved-session namespace. */
    realm: "ccm",
    /** Preserve the CCM session in this tab across reloads. */
    session: true,
    /** Profile preferences passed to the server together with the Google proof. */
    displayName: "name", // name, given_name, family_name, email or id
    picture: true,
    ui: ["ccm.load", "././libs/ccm-ui/ccm-ui.mjs"],
    views: ["ccm.load", "././resources/views.mjs"],
    css: ["ccm.load", "././resources/styles.css"],
    extensions: [],
    labels: {
      button: "Sign in with Google",
      logout: "Sign out",
      invalidResponse: "The server returned an invalid authentication response.",
      disabled: "Login is currently unavailable.",
      failed: "Google sign-in failed. Please try again.",
      popupBlocked: "Please allow the login popup and try again.",
      timeout: "Google sign-in timed out. Please try again.",
      cancelled: "Login cancelled.",
      popup: {
        language: "en",
        title: "Sign in with Google",
        heading: "Sign in for",
        retry: "Try again",
        loading: "Loading Google sign-in …",
        transferring: "Returning sign-in to the website …",
        loadFailed: "Google could not be loaded. Please try again.",
        invalidURL: "An HTTPS address is required (HTTP is allowed locally).",
        invalidRequest: "Please open this page using the user component's Google button.",
        missingClientId: "The Google client ID is missing in resources/configs.mjs.",
      },
    },
  },
  Instance: function () {
    /** Temporary interface state; no credentials are stored in GUI state. */
    this.gui = {
      /** Whether this instance is obtaining or delivering a Google credential. */
      busy: false,
      /** Whether the embedding application currently prevents a new login. */
      disabled: false,
      /** Error displayed below the button. */
      message: "",
    };

    /** Public metadata is returned only as a copy; the CCM JWT stays separate. */
    let state = null;
    /** CCM authentication token, never the Google ID token. */
    let token = null;
    /** Active popup and shared promise, also used to invalidate canceled results. */
    let pending = null;

    /** Normalizes the server URL before session storage is accessed. */
    this.init = async () => {
      this.server = new URL(this.server).href;
      await this.emit("init");
    };

    /** Announces that dependencies and configuration are available. */
    this.ready = async () => {
      const saved = storage("getItem");
      if (saved) {
        try {
          const session = JSON.parse(saved);
          if (validSession(session)) acceptSession(session);
          else storage("removeItem");
        } catch { storage("removeItem"); }
      }
      await this.emit("ready");
    };

    /** Renders the button without resetting an active login. */
    this.start = async () => {
      render();
      await this.emit("start");
    };

    /** Identifies the authentication provider for a consuming application. */
    this.getProvider = () => "google";

    /** Returns a copy of CCM user metadata, or `null` when signed out. */
    this.getState = () => state && { ...state };

    /** Returns the CCM JWT for authenticated datastore requests. */
    this.getToken = () => token;

    /** Reports whether this instance holds a CCM session. */
    this.isLoggedIn = () => token !== null;

    /** Identifies this instance as the owner of its session for shared datastore retries. */
    this.getSessionOwner = () => this;

    /** Discards the local CCM session and cancels pending authentication without signing out of Google. */
    this.logout = async () => {
      const changed = token !== null;
      token = null;
      state = null;
      storage("removeItem");
      await this.cancel();
      if (changed) await this.emit("logout");
    };

    /** Enables or disables new logins without interrupting an active popup. */
    this.setDisabled = (disabled) => {
      this.gui.disabled = !!disabled;
      render();
    };

    /**
     * Opens Google sign-in and delivers the proof to login extensions before resolving.
     * @returns {Promise<Object>} CCM user metadata
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
      operation.promise = completeLogin(operation, operation.promise);
      return operation.promise;
    };

    /** Cancels provider work and clears the previous proof without signing out of Google. */
    this.cancel = async () => {
      const operation = pending;
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

    /** Dispatches events sequentially to the configured extensions. */
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

    /** Checks metadata and token format; the server validates the JWT on authenticated requests. */
    const validSession = value => value && this.ccm.helper.isKey(value.key) && typeof value.key === "string" &&
      typeof value.user === "string" && value.realm === this.realm && value.provider === "google" &&
      typeof value.token === "string" && !!value.token;

    /** Accepts only the public metadata and token, discarding all other response fields. */
    const acceptSession = session => {
      token = session.token;
      state = { key: session.key, user: session.user, realm: session.realm, provider: session.provider };
      if (this.picture && typeof session.picture === "string" && session.picture.startsWith("https://"))
        state.picture = session.picture;
    };

    /** Opens the hosted login page; only its matching window, origin and request may reply. */
    const openPopup = () => {
      const { labels } = this;
      const url = new URL(this.url || "./auth.html", import.meta.url);
      const request = crypto.randomUUID();
      url.hash = new URLSearchParams({ origin: location.origin, request }).toString();
      const popup = window.open(url.href, "_blank", "popup,width=520,height=680");
      if (!popup) return { promise: Promise.reject(new Error(labels.popupBlocked)), cancel() {} };
      let cancel;
      const promise = new Promise((resolve, reject) => {
        let finished = false;
        const finish = (error, credential) => {
          if (finished) return;
          finished = true;
          window.removeEventListener("message", receive);
          clearInterval(closed);
          clearTimeout(timeout);
          popup.close();
          error ? reject(error) : resolve(credential);
        };
        const receive = event => {
          if (event.origin !== url.origin || event.source !== popup || event.data?.request !== request) return;
          if (event.data.type === "ccm-google-ready") {
            popup.postMessage({ type: "ccm-google-init", request, labels: labels.popup }, url.origin);
          } else if (event.data.type === "ccm-google-result" && typeof event.data.idToken === "string") {
            finish(null, { idToken: event.data.idToken });
          }
        };
        window.addEventListener("message", receive);
        const closed = setInterval(() => {
          if (popup.closed) finish(new DOMException(labels.cancelled, "AbortError"));
        }, 500);
        const timeout = setTimeout(() => finish(new Error(labels.timeout)), 5 * 60 * 1000);
        cancel = () => finish(new DOMException(labels.cancelled, "AbortError"));
      });
      return { promise, cancel: () => cancel() };
    };

    /** Completes one popup attempt; cancelled attempts cannot publish a late credential. */
    const completeLogin = async (operation, result) => {
      // Observe popup rejection immediately, even while an extension is still processing before-login.
      const outcome = result.then(value => ({ value }), error => ({ error }));
      try {
        await this.emit("before-login");
        const { value, error } = await outcome;
        if (pending !== operation) throw new DOMException(this.labels.cancelled, "AbortError");
        if (error) throw error;
        if (typeof value?.idToken !== "string" || !value.idToken) throw new Error(this.labels.failed);
        const credential = { idToken: value.idToken, displayName: this.displayName, picture: this.picture };
        const session = await this.ccm.load({
          url: this.server, method: "POST",
          params: { login: "google", credentials: credential, realm: this.realm },
        });
        // Logout or cancellation can happen while the server is still responding.
        if (pending !== operation) throw new DOMException(this.labels.cancelled, "AbortError");
        if (!validSession(session)) throw new Error(this.labels.invalidResponse);
        acceptSession(session);
        storage("setItem", JSON.stringify({ token, ...state }));
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
        operation.cancel();
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
