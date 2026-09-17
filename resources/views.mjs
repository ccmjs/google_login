/** Renders the provider button and an accessible error message. */
export function main(app) {
  const state = app.getState();
  return app.ui.html`
    <div>
    ${state ? app.ui.html`
      <div class="profile">
        ${state.picture ? app.ui.html`<img src="${escape(state.picture)}" alt="" referrerpolicy="no-referrer">` : ""}
        <span>${escape(state.user)}</span>
      </div>
      <button type="button" data-on-click="logout">${escape(app.labels.logout)}</button>
    ` : app.ui.html`<button type="button" data-on-click="login" ${app.gui.busy || app.gui.disabled ? "disabled" : ""}
            aria-busy="${app.gui.busy}">${escape(app.labels.button)}</button>`}
    <p role="status" aria-live="polite">${escape(app.gui.message)}</p>
    </div>
  `;
}

/** Creates the hosted popup's initial structure; labels are filled after the opener handshake. */
export function popup() {
  return `
  <main>
    <h1><span id="heading"></span> <strong id="origin"></strong></h1>
    <button id="retry" type="button" hidden></button>
    <div id="google"></div>
    <p id="message" role="status" aria-live="polite"></p>
  </main>
  `;
}

/** Escapes configurable labels before inserting them into HTML. */
function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
