/** Installs a minimal browser surface while exercising the component's real popup handling. */
export function browser(t, automatic = false) {
  const previous = new Map(["window", "location"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const listeners = new Set();
  const windows = [];
  globalThis.location = { origin: "https://app.example" };
  globalThis.window = {
    open(value) {
      const url = new URL(value);
      const popup = { closed: false, close() { this.closed = true; }, postMessage() {},
        reply(idToken = "proof") {
          for (const receive of [...listeners]) receive({ source: popup, origin: url.origin,
            data: { type: "ccm-google-result", request: new URLSearchParams(url.hash.slice(1)).get("request"), idToken } });
        },
      };
      windows.push(popup);
      if (automatic) queueMicrotask(() => popup.reply("google-proof"));
      return popup;
    },
    addEventListener(type, listener) { listeners.add(listener); },
    removeEventListener(type, listener) { listeners.delete(listener); },
  };
  t.after(() => {
    for (const [name, descriptor] of previous)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  return windows;
}
