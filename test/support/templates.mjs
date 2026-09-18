/** Models escaped strings and nested template results for view-only unit tests. */
export const raw = value => new String(value);
export function html(parts, ...values) {
  const encode = value => {
    if (value instanceof String) return value.toString();
    if (typeof value === "string" || typeof value === "number")
      return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      })[char]);
    return "";
  };
  return raw(parts.reduce((text, part, i) => text + part + encode(values[i]), ""));
}
