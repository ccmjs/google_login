import { popup } from "./views.mjs";

// Build the popup before looking up its fields or accepting messages from the opener.
document.body.innerHTML = popup();

/** Fallback errors for direct or invalid calls before configuration arrives. */
let labels = {
  invalidURL: "An HTTPS address is required (HTTP is allowed locally).",
  invalidRequest: "Please open this page using the user component's Google button.",
};

const params = new URLSearchParams(location.hash.slice(1));
const request = params.get("request");
const origin = params.get("origin");
const message = document.querySelector("#message");
const retry = document.querySelector("#retry");
/** Public client ID supplied by the verified opener handshake. */
let clientId;
let initialized = false;
let completed = false;

/** Applies plain text labels without interpreting configuration as HTML. */
function applyLabels() {
  document.title = labels.title;
  document.documentElement.lang = labels.language;
  document.querySelector("#heading").textContent = labels.heading;
  retry.textContent = labels.retry;
}

message.textContent = "Waiting for the requesting website …";

function allowedURL(value) {
  const url = new URL(value);
  if (url.username || url.password ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))))
    throw new Error(labels.invalidURL);
  return url;
}

function send(type, extra = {}) {
  window.opener.postMessage({ type, request, ...extra }, origin);
}

try {
  if (!window.opener || !request || request.length > 128 || allowedURL(origin).origin !== origin)
    throw new Error(labels.invalidRequest);
  document.querySelector("#origin").textContent = origin;
  window.addEventListener("message", event => {
    if (initialized || event.source !== window.opener || event.origin !== origin ||
        event.data?.type !== "ccm-google-init" || event.data.request !== request) return;
    try {
      // The component supplies its complete labels after CCM has merged configuration overrides.
      const received = event.data.labels;
      if (!["language", "title", "heading", "retry", "loading", "transferring", "loadFailed",
        "invalidURL", "invalidRequest", "missingClientId"].every(key => typeof received?.[key] === "string"))
        throw new Error(labels.invalidRequest);
      labels = received;
      applyLabels();
      if (typeof event.data.clientId !== "string" || !event.data.clientId.trim())
        throw new Error(labels.missingClientId);
      clientId = event.data.clientId;
      initialized = true;
      loadGoogle();
    } catch (error) { message.textContent = error.message; }
  });
  send("ccm-google-ready");
} catch (error) { message.textContent = error.message; }

/** Loads the Google button after the opener handshake, or retries a failed load. */
function loadGoogle() {
  retry.hidden = true;
  message.textContent = labels.loading;
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: clientId, ux_mode: "popup", auto_select: false,
      callback: response => {
        if (completed || typeof response.credential !== "string") return;
        completed = true;
        send("ccm-google-result", { idToken: response.credential });
        message.textContent = labels.transferring;
      },
    });
    google.accounts.id.renderButton(document.querySelector("#google"), {
      type: "standard", theme: "outline", size: "large", locale: labels.language,
    });
    message.textContent = "";
  };
  script.onerror = () => {
    message.textContent = labels.loadFailed;
    retry.hidden = false;
    script.remove();
  };
  document.head.append(script);
}

retry.addEventListener("click", loadGoogle);
