/** Interface text for the Google Login component and its hosted popup. */
export const labels = {
  /** English defaults. The popup receives its own labels from the requesting instance. */
  en: {
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
    /** Message of the AbortError returned when login is canceled. */
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
      /** Status until the requesting page sends its configuration. */
      waiting: "Waiting for the requesting website …",
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

  /** German translations. The language code also selects the Google button locale. */
  de: {
    button: "Mit Google anmelden",
    logout: "Abmelden",
    invalidResponse: "Der Server hat eine ungültige Antwort auf die Anmeldung gesendet.",
    disabled: "Die Anmeldung ist derzeit nicht verfügbar.",
    failed: "Die Anmeldung mit Google ist fehlgeschlagen. Bitte versuche es erneut.",
    popupBlocked: "Bitte erlaube das Anmeldefenster und versuche es erneut.",
    timeout: "Die Zeit für die Anmeldung mit Google ist abgelaufen. Bitte versuche es erneut.",
    cancelled: "Anmeldung abgebrochen.",
    popup: {
      language: "de",
      title: "Mit Google anmelden",
      heading: "Anmelden für",
      retry: "Erneut versuchen",
      waiting: "Warten auf die anfragende Website …",
      loading: "Google-Anmeldung wird geladen …",
      transferring: "Anmeldung wird an die Website übermittelt …",
      loadFailed: "Google konnte nicht geladen werden. Bitte versuche es erneut.",
      invalidURL: "Eine HTTPS-Adresse ist erforderlich. Lokal ist auch HTTP erlaubt.",
      invalidRequest: "Bitte öffne diese Seite über die Google-Schaltfläche in der Anwendung.",
      missingClientId: "Die Google-Client-ID fehlt in der Konfiguration der Komponente.",
    },
  },
};

/** Button icons accept trusted inline SVG markup or an image URL. */
export const icons = {
  /** The sign-out button uses labels.logout as its accessible name. */
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
        focusable="false"><path d="M9 4H4v16h5 M10 12h10 M16 8l4 4-4 4"/></svg>`,
};
