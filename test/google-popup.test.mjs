import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../ccm.google_login.mjs";

/** Exercises popup communication through the component's public login API. */
function login(config) {
  const app = Object.assign(new component.Instance(), component.config, {
    session: false, element: {}, ui: { render() {} }, views: { main() {} },
    ccm: { helper: { isKey: key => typeof key === "string" && !!key },
      load: async () => ({ key: "account", user: "Person", realm: "ccm", provider: "google", token: "jwt" }) },
  }, config);
  return { promise: app.login(), cancel: () => app.cancel() };
}

test("popup accepts only its own origin, window and request and cleans up", async t => {
  const previous = { window: globalThis.window, location: globalThis.location };
  t.after(() => Object.assign(globalThis, previous));
  let receive, opened;
  const messages = [];
  const popup = { closed: false, close() { this.closed = true; }, postMessage(...args) { messages.push(args); } };
  globalThis.location = { origin: "https://embedding.example" };
  globalThis.window = {
    open(url) { opened = new URL(url); return popup; },
    addEventListener(type, fn) { receive = fn; },
    removeEventListener() { receive = null; },
  };
  const operation = login({ url: "https://login.example/auth.html", labels: { popup: { heading: "Anmelden für" } } });
  const request = new URLSearchParams(opened.hash.slice(1)).get("request");
  const data = { type: "ccm-google-result", request, idToken: "proof" };
  receive({ origin: "https://wrong.example", source: popup, data });
  receive({ origin: opened.origin, source: {}, data });
  receive({ origin: opened.origin, source: popup, data: { ...data, request: "wrong" } });
  assert.equal(popup.closed, false);
  receive({ origin: opened.origin, source: popup, data: { type: "ccm-google-ready", request } });
  assert.equal(messages[0][1], opened.origin);
  assert.deepEqual(messages[0][0].labels, { heading: "Anmelden für" });
  receive({ origin: opened.origin, source: popup, data });
  assert.deepEqual(await operation.promise, { key: "account", user: "Person", realm: "ccm", provider: "google" });
  assert.equal(receive, null); assert.equal(popup.closed, true);
});

test("blocked, closed, cancelled and timed-out popups reject without leaving listeners or timers", async t => {
  for (const reason of ["blocked", "closed", "cancelled", "timeout"]) {
    await t.test(reason, async t => {
      const names = ["window", "location", "setInterval", "clearInterval", "setTimeout", "clearTimeout"];
      const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
      t.after(() => {
        for (const [name, descriptor] of previous)
          if (descriptor) Object.defineProperty(globalThis, name, descriptor);
          else delete globalThis[name];
      });
      const timers = new Map();
      let listener;
      const popup = { closed: false, close() { this.closed = true; } };
      globalThis.location = { origin: "https://embedding.example" };
      globalThis.window = {
        open: () => reason === "blocked" ? null : popup,
        addEventListener(type, callback) { listener = callback; },
        removeEventListener() { listener = undefined; },
      };
      globalThis.setInterval = callback => { timers.set("poll", callback); return "poll"; };
      globalThis.setTimeout = callback => { timers.set("timeout", callback); return "timeout"; };
      globalThis.clearInterval = globalThis.clearTimeout = id => timers.delete(id);
      const operation = login({ url: "https://login.example/auth.html", labels: {
        popupBlocked: "Blocked", timeout: "Timed out", cancelled: "Cancelled",
      } });
      const rejected = assert.rejects(operation.promise, reason === "blocked" ? /Blocked/
        : reason === "timeout" ? /Timed out/ : { name: "AbortError" });
      if (reason === "closed") { popup.closed = true; timers.get("poll")(); }
      if (reason === "cancelled") { operation.cancel(); operation.cancel(); }
      if (reason === "timeout") timers.get("timeout")();
      await rejected;
      assert.equal(listener, undefined);
      assert.equal(timers.size, 0);
      if (reason !== "blocked") assert.equal(popup.closed, true);
    });
  }
});
