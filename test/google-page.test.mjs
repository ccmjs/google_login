import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { component } from "../ccm.google_login.mjs";
import { popup } from "../resources/views.mjs";
const defaults = component.config;

test("hosted page requires validated opener handshake before automatically loading Google", async () => {
  const elements = new Map();
  const element = key => {
    if (!elements.has(key)) elements.set(key, { disabled: true, addEventListener(type, fn) { this[type] = fn; } });
    return elements.get(key);
  };
  const replies = []; const scripts = []; let receive, options;
  const opener = { postMessage(...args) { replies.push(args); } };
  const context = {
    popup, URL, URLSearchParams,
    location: { hash: '#origin=https%3A%2F%2Fapp.example&request=test' },
    window: { opener, addEventListener(type, fn) { receive = fn; }, close() {} },
    document: { body: {}, documentElement: {}, querySelector: element, createElement() { return { remove() { this.removed = true; } }; }, head: { append(script) { scripts.push(script); } } },
    google: { accounts: { id: { initialize(value) { options = value; }, renderButton() {} } } },
  };
  const source = (await readFile(new URL('../resources/auth.mjs', import.meta.url), 'utf8')).replace('import { popup } from "./views.mjs";', '');
  vm.runInNewContext(source, context);
  for (const id of ["heading", "origin", "retry", "google", "message"])
    assert.ok(context.document.body.innerHTML.includes(`id="${id}"`));
  assert.equal(scripts.length, 0);
  receive({ source: {}, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'test' } });
  assert.equal(scripts.length, 0);
  receive({ source: opener, origin: 'https://wrong.example', data: { type: 'ccm-google-init', request: 'test' } });
  receive({ source: opener, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'wrong' } });
  assert.equal(scripts.length, 0);
  receive({ source: opener, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'test', labels: {} } });
  assert.equal(scripts.length, 0);
  assert.match(element('#message').textContent, /Please open this page/);
  for (const clientId of [undefined, null, 123, "", "   "]) {
    receive({ source: opener, origin: 'https://app.example', data: {
      type: 'ccm-google-init', request: 'test', clientId, labels: defaults.labels.popup,
    } });
    assert.equal(scripts.length, 0);
    assert.equal(element('#message').textContent, defaults.labels.popup.missingClientId);
  }
  receive({ source: opener, origin: 'https://app.example', data: { type: 'ccm-google-init', request: 'test', clientId: 'custom-client', labels: { ...defaults.labels.popup, heading: '<b>Anmelden für</b>', loading: 'Wird geladen …', language: 'de' } } });
  assert.equal(scripts.length, 1);
  assert.equal(context.document.title, 'Sign in with Google');
  assert.equal(element('#heading').textContent, '<b>Anmelden für</b>');
  assert.equal(element('#message').textContent, 'Wird geladen …');
  assert.equal(context.document.documentElement.lang, 'de');
  assert.equal(element('#origin').textContent, 'https://app.example');
  assert.equal(scripts[0].src, 'https://accounts.google.com/gsi/client');
  scripts[0].onerror();
  assert.equal(scripts[0].removed, true);
  assert.equal(element('#retry').hidden, false);
  assert.equal(element('#message').textContent, defaults.labels.popup.loadFailed);
  element('#retry').click();
  assert.equal(scripts.length, 2);
  assert.equal(element('#retry').hidden, true);
  scripts[1].onload();
  assert.equal(options.client_id, "custom-client");
  assert.equal(options.ux_mode, 'popup');
  options.callback({ credential: 'proof' });
  assert.equal(replies.at(-1)[0].idToken, 'proof');
  assert.equal(replies.at(-1)[1], 'https://app.example');
  assert.equal(context.location.hash.includes('proof'), false);
  const count = replies.length;
  options.callback({ credential: 'duplicate-proof' });
  assert.equal(replies.length, count);
});
