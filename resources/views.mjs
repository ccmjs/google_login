export function main(t){const i=t.getState();return t.ui.html`
    <div class="account">
    ${i?t.ui.html`
      <div class="profile">
        ${i.picture?t.ui.html`<img src="${i.picture}" alt="" referrerpolicy="no-referrer">`:""}
        <span class="name" title="${i.user}">${i.user}</span>
        <button class="logout" type="button" data-on-click="logout"
          aria-label="${t.labels.logout}" title="${t.labels.logout}">${function(t){const i=t.icons.logout.trim(),n=/^<svg[\s>]/i.test(i)?t.ui.raw(i):t.ui.html`<img src="${i}" alt="">`;return t.ui.html`<span class="icon" aria-hidden="true">${n}</span>`}(t)}</button>
      </div>
    `:t.ui.html`<button type="button" data-on-click="login" ${t.gui.busy||t.gui.disabled?"disabled":""}
            aria-busy="${String(t.gui.busy)}">${t.labels.button}</button>`}
    <p role="status" aria-live="polite">${t.gui.message}</p>
    </div>
  `}export function popup(){return'\n  <main>\n    <h1><span id="heading"></span> <strong id="origin"></strong></h1>\n    <button id="retry" type="button" hidden></button>\n    <div id="google"></div>\n    <p id="message" role="status" aria-live="polite"></p>\n  </main>\n  '}
//# sourceMappingURL=https://cdn.jsdelivr.net/gh/ccmjs/google_login@v1.0.1/resources/views.mjs.map