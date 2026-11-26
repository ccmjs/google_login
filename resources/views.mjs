/** Renders a compact login or account control with an accessible error message. */
export function main(app) {
  const state = app.getState();
  return app.ui.html`
    <div class="account">
    ${state ? app.ui.html`
      <div class="profile">
        ${state.picture ? app.ui.html`<img src="${state.picture}" alt="" referrerpolicy="no-referrer">` : ""}
        <span class="name" title="${state.user}">${state.user}</span>
        <button class="logout" type="button" data-on-click="logout"
          aria-label="${app.labels.logout}" title="${app.labels.logout}">${logoutIcon(app)}</button>
      </div>
    ` : app.ui.html`<button type="button" data-on-click="login" ${app.gui.busy || app.gui.disabled ? "disabled" : ""}
            aria-busy="${String(app.gui.busy)}">${app.labels.button}</button>`}
    <p role="status" aria-live="polite">${app.gui.message}</p>
    </div>
  `;
}

/** The popup uses bundled labels on opening and applies the caller's labels after the handshake. */
export function popup() {
  return `
  <main class="login-popup">
    <h1 id="title"></h1>
    <p class="requester"><span id="heading"></span><strong id="origin"></strong></p>
    <button id="retry" type="button" hidden></button>
    <div id="google"></div>
    <p id="message" role="status" aria-live="polite"></p>
  </main>
  `;
}

/** Renders the configurable sign-out icon; the button provides its accessible name. */
function logoutIcon(app) {
  const source = app.icons.logout.trim();
  const content = /^<svg[\s>]/i.test(source) ? app.ui.raw(source) : app.ui.html`<img src="${source}" alt="">`;
  return app.ui.html`<span class="icon" aria-hidden="true">${content}</span>`;
}
