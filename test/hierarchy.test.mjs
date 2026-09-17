import test from "node:test";
import assert from "node:assert/strict";
import { component } from "../ccm.google_login.mjs";
import { browser } from "./support/browser.mjs";

/** Builds an app host with a config.user instance and controlled CCM transport. */
function create(parent = null, config = {}, definition = component) {
  const calls = { requests: 0, renders: 0, cleared: 0, events: [] };
  const host = { parent };
  const app = Object.assign(new definition.Instance(), definition.config, {
    parent: host, session: false,
    element: { replaceChildren() { calls.cleared++; } },
    ui: { render() { calls.renders++; } }, views: { main() {} },
    ccm: { helper: { isKey: value => typeof value === "string" && !!value },
      load: async () => { calls.requests++; return {
        key: "account", user: "Person", realm: "ccm", provider: "google", token: "jwt",
      }; } },
    extensions: [event => calls.events.push(event)],
  }, config);
  host.user = app;
  return { app, host, calls };
}

/** Mirrors CCM's all-init-before-ready lifecycle, with descendants becoming ready first. */
async function prepare(...instances) {
  for (const { app } of instances) await app.init();
  for (const { app } of [...instances].reverse()) await app.ready();
}

test("deep children use the highest owner, one popup and transport, and receive session events once", async t => {
  const windows = browser(t);
  const root = create(null, { server: "http://localhost:8080" });
  const middle = create(root.host, { server: "http://localhost:8080/" });
  const leaf = create(middle.host);
  await prepare(root, middle, leaf);
  for (const { app } of [root, middle, leaf]) await app.start();
  assert.equal(leaf.app.getSessionOwner(), root.app);
  assert.equal(middle.app.getSessionOwner(), root.app);
  assert.equal(root.calls.renders, 1); assert.equal(leaf.calls.renders, 0); assert.equal(leaf.calls.cleared, 1);
  const a = leaf.app.login(), b = middle.app.login();
  assert.equal(a, b); assert.equal(windows.length, 1); windows[0].reply(); await a;
  assert.equal(root.calls.requests, 1); assert.equal(leaf.calls.requests, 0);
  assert.equal(leaf.app.getToken(), "jwt"); assert.deepEqual(leaf.app.getState(), root.app.getState());
  leaf.app.getState().user = "changed"; assert.equal(root.app.getState().user, "Person");
  await middle.app.logout(); assert.equal(leaf.app.isLoggedIn(), false);
  for (const { app, calls } of [root, middle, leaf]) {
    assert.equal(calls.events.filter(event => event.type === "login").length, 1);
    assert.equal(calls.events.filter(event => event.type === "logout").length, 1);
    assert.equal(calls.events.filter(event => event.type === "ready").length, 1);
    assert.ok(calls.events.every(event => event.app === app));
  }
});

test("different server, realm or client ID and sibling branches remain independent", async () => {
  for (const config of [{ server: "https://other.example" }, { realm: "other" }, { clientId: "other" }]) {
    const root = create(), child = create(root.host, config); await prepare(root, child);
    assert.equal(child.app.getSessionOwner(), child.app);
  }
  const host = { parent: null };
  const a = create(host), b = create(host); await prepare(a, b);
  assert.equal(a.app.getSessionOwner(), a.app); assert.equal(b.app.getSessionOwner(), b.app);
});

test("child cancellation and disabling act on the owner", async t => {
  const windows = browser(t); const root = create(), child = create(root.host); await prepare(root, child);
  child.app.setDisabled(true); await assert.rejects(root.app.login()); assert.equal(windows.length, 0);
  child.app.setDisabled(false);
  const rejected = assert.rejects(child.app.login(), { name: "AbortError" });
  await child.app.cancel(); await rejected;
  assert.equal(windows[0].closed, true); assert.equal(root.app.gui.busy, false);
});

test("only the owner restores and removes the saved session", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  let reads = 0, removed = 0;
  globalThis.sessionStorage = {
    getItem() { reads++; return JSON.stringify({ key: "account", user: "Person", realm: "ccm", provider: "google", token: "saved" }); },
    removeItem() { removed++; },
  };
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else delete globalThis.sessionStorage; });
  const root = create(null, { session: true }), child = create(root.host, { session: true }); await prepare(root, child);
  assert.equal(reads, 1); assert.equal(child.app.getToken(), "saved");
  await child.app.logout(); assert.equal(removed, 1);
});

test("different module versions share the public session interface", async t => {
  browser(t, true);
  const { component: other } = await import("../ccm.google_login.mjs?hierarchy-test");
  const root = create(), child = create(root.host, {}, other); await prepare(root, child);
  await child.app.login(); assert.equal(child.app.getSessionOwner(), root.app);
  assert.equal(child.app.getToken(), "jwt"); assert.equal(root.calls.requests, 1); assert.equal(child.calls.requests, 0);
});
