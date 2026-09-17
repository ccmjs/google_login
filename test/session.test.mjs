import test, { beforeEach } from "node:test";
import { browser } from "./support/browser.mjs";
beforeEach(t => browser(t, true));
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { component } from "../ccm.google_login.mjs";

const window = {};
vm.runInNewContext(readFileSync(new URL("../libs/framework/ccm.js", import.meta.url), "utf8"), { window });
const identity = { key: "account", user: "Person", realm: "ccm", provider: "google" };
const response = { ...identity, token: "ccm-jwt", picture: "https://example.org/avatar.png" };

/** Uses the real metadata validator with controlled popup and transport responses. */
function create(config = {}) {
  const requests = [];
  const events = [];
  const app = Object.assign(new component.Instance(), component.config, {
    session: false, element: {}, views: { main() {} }, ui: { render() {} },
    ccm: { helper: window.ccm.helper, async load(request) { requests.push(request); return response; } },
    extensions: [({ type }) => events.push(type)],
  }, config);
  return { app, requests, events };
}

test("standalone login exchanges Google proof for a private CCM token and public metadata", async () => {
  const { app, requests, events } = create();
  await app.init(); await app.ready();
  const state = await app.login();
  assert.deepEqual(requests[0].params, { login: "google", realm: "ccm",
    credentials: { idToken: "google-proof", displayName: "name", picture: true } });
  assert.deepEqual(state, { ...identity, picture: response.picture });
  state.user = "mutated";
  assert.equal(app.getState().user, "Person");
  assert.equal(app.getToken(), "ccm-jwt");
  assert.equal(app.isLoggedIn(), true);
  await app.login(); assert.equal(requests.length, 1);
  await app.logout();
  assert.equal(app.getState(), null); assert.equal(app.getToken(), null);
  assert.deepEqual(events.slice(-2), ["cancel", "logout"]);
  await app.login(); assert.equal(requests.length, 2);
});

test("logout invalidates a server response that arrives after cancellation", async () => {
  let reply, started;
  const ready = new Promise(resolve => { started = resolve; });
  const { app } = create({ ccm: { helper: window.ccm.helper, load() {
    started(); return new Promise(resolve => { reply = resolve; });
  } } });
  const rejected = assert.rejects(app.login(), { name: "AbortError" });
  await ready; await app.logout(); reply(response); await rejected;
  assert.equal(app.getToken(), null); assert.equal(app.isLoggedIn(), false);
});

test("invalid server identities never establish a session", async () => {
  for (const invalid of [{ ...response, provider: "ccm" }, { ...response, realm: "other" },
    { ...response, key: [] }, { ...response, token: "" }, null]) {
    const { app } = create({ ccm: { helper: window.ccm.helper, load: async () => invalid } });
    await assert.rejects(app.login());
    assert.equal(app.isLoggedIn(), false); assert.equal(app.gui.busy, false);
  }
});

test("accepted session survives a login extension error", async () => {
  const { app } = create({ extensions: [({ type }) => { if (type === "login") throw new Error("consumer"); }] });
  await assert.rejects(app.login(), /consumer/);
  assert.equal(app.getToken(), "ccm-jwt");
});

test("sessions restore locally, separate realms and never persist the Google proof", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key),
  };
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else delete globalThis.sessionStorage; });
  const first = create({ session: true }); await first.app.init(); await first.app.ready(); await first.app.login();
  assert.doesNotMatch([...data.values()][0], /google-proof|idToken/);
  const restored = create({ session: true }); await restored.app.init(); await restored.app.ready();
  assert.equal(restored.app.getToken(), "ccm-jwt"); assert.equal(restored.requests.length, 0);
  const other = create({ session: true, realm: "other" }); await other.app.init(); await other.app.ready();
  assert.equal(other.app.isLoggedIn(), false);
  await restored.app.logout(); assert.equal(data.size, 0);
  data.set('ccm-google-session:["http://localhost:8080/","ccm"]', '{broken');
  const broken = create({ session: true }); await broken.app.init(); await broken.app.ready();
  assert.equal(data.size, 0);
});

test("blocked storage and suppressed pictures still allow login", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("blocked"); } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else delete globalThis.sessionStorage; });
  const { app } = create({ session: true, picture: false }); await app.init(); await app.ready();
  await app.login(); assert.equal(app.getState().picture, undefined); await app.logout();
});
