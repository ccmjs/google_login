// Public OAuth Web client ID. Never put a client secret in this repository.
// Register this page's origin (without /google_login/auth.html) in Google Cloud Console.
export const clientId =
  "90855209934-9vas1fscpkefmglhfou7lut1uhv62ear.apps.googleusercontent.com";

/** Standalone Google login with a CCM session from the local server. */
export const demo = {
  url: "https://ccmjs.github.io/google_login/auth.html",
  server: "http://localhost:8080",
  realm: "ccm",
  displayName: "name",
  picture: true,
  extensions: [["ccm.load", "././resources/extensions.mjs#result"]],
};
