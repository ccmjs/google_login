import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../ccm.google_login.mjs";
import * as views from "../resources/views.mjs";
import { browser } from "./support/browser.mjs";

/** Creates an instance with mocked transport and the real private popup implementation. */
function create(config = {}) {
  return Object.assign(new component.Instance(), component.config, {
    session: false, element: {}, views: { main() {} }, ui: { render() {} },
    ccm: { helper: { isKey: key => typeof key === "string" && !!key },
      load: async () => ({ key: "account", user: "Person", realm: "ccm", provider: "google", token: "jwt" }) },
  }, config);
}

test("a shared login emits the provider-owned session", async t => {
  const windows = browser(t);
  const events = [];
  const app = create({ extensions: [({ app, type }) => {
    events.push(type); if (type === "login") assert.equal(app.getToken(), "jwt");
  }] });
  const first = app.login();
  assert.equal(first, app.login()); assert.equal(windows.length, 1);
  windows[0].reply();
  assert.deepEqual(await first, { key: "account", user: "Person", realm: "ccm", provider: "google" });
  assert.deepEqual(events, ["before-login", "login", "finish"]);
  const copy = app.getState(); copy.user = "changed";
  assert.equal(app.getState().user, "Person"); assert.equal(app.gui.busy, false);
});

test("cancellation rejects callers and ignores late popup results", async t => {
  const windows = browser(t); const app = create();
  const waiting = assert.rejects(app.login(), { name: "AbortError" });
  await app.cancel(); windows[0].reply("late"); await waiting;
  assert.equal(app.getState(), null); assert.equal(app.gui.busy, false);
  assert.equal(windows[0].closed, true);
});

test("disabled instances never open a popup", async t => {
  const windows = browser(t); const app = create(); app.setDisabled(true);
  await assert.rejects(app.login(), { message: component.config.labels.disabled });
  assert.equal(windows.length, 0);
});

test("extension failure cleans up the popup and permits a retry", async t => {
  const windows = browser(t);
  const app = create({ extensions: [({ type }) => { if (type === "before-login") throw new Error("Consumer failed"); }] });
  await assert.rejects(app.login(), /Consumer failed/);
  assert.equal(windows[0].closed, true); assert.equal(app.getState(), null); assert.equal(app.gui.busy, false);
  app.extensions = []; const retry = app.login(); windows[1].reply(); await retry;
  assert.equal(app.isLoggedIn(), true);
});

test("malformed credentials cannot emit login", async t => {
  const windows = browser(t); const events = [];
  const app = create({ extensions: [({ type }) => events.push(type)] });
  const promise = app.login(); windows[0].reply(""); await assert.rejects(promise);
  assert.deepEqual(events, ["before-login", "error", "finish"]);
});

test("instances have independent pending logins", async t => {
  const windows = browser(t); const a = create(), b = create();
  const rejected = assert.rejects(a.login(), { name: "AbortError" }); const success = b.login();
  await a.cancel(); windows[1].reply(); await rejected;
  assert.equal((await success).provider, "google");
});

test("views escape labels and messages and disable busy buttons", () => {
  const app = { getState: () => null, gui: { busy: true, message: "<script>" }, labels: { button: "<b>Google</b>" },
    ui: { html: (strings, ...values) => strings.reduce((text, part, i) => text + part + (values[i] ?? ""), "") } };
  const html = views.main(app);
  assert.match(html, /disabled/); assert.match(html, /&lt;b&gt;/); assert.doesNotMatch(html, /<script>/);
});
