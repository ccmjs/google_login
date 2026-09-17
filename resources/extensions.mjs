/** Shows demo success without exposing the Google ID token in the DOM or console. */
export function result({ app, type }) {
  if (type !== "finish" || !app.isLoggedIn()) return;
  app.element.querySelector('[role="status"]').textContent =
    "Google authentication succeeded. The CCM session is ready.";
}
