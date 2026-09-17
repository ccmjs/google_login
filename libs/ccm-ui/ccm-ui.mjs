/**
 * @module ccm-ui
 * @description Minimal UI utilities for ccmjs (templating + rendering)
 *
 * Features:
 * - Template literal HTML creation
 * - DOM rendering helper
 * - Declarative event binding via `data-on-*`
 * - Automatic integration with `instance.events`
 * - No public bind() API (handled internally by render)
 */

/**
 * Creates DOM nodes from a template literal.
 *
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {Node|DocumentFragment}
 */
export function html(strings, ...values) {
  const template = document.createElement("template");
  let result = "";

  const placeholders = new Map();

  function process(value, key) {
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }

    if (value instanceof Node) {
      const id = `ccm-node-${key}`;
      placeholders.set(id, value);
      return `<!--${id}-->`;
    }

    if (Array.isArray(value)) {
      return value.map((v, i) => process(v, `${key}-${i}`)).join("");
    }

    return "";
  }

  strings.forEach((str, i) => {
    result += str;

    if (i < values.length) {
      result += process(values[i], i);
    }
  });

  template.innerHTML = result.trim();
  const fragment = template.content;

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);

  const toReplace = [];

  let node;
  while ((node = walker.nextNode())) {
    const id = node.nodeValue.trim();
    const replacement = placeholders.get(id);

    if (replacement) {
      toReplace.push({ node, replacement });
    }
  }

  toReplace.forEach(({ node, replacement }) => {
    node.replaceWith(replacement);
  });

  return fragment.childNodes.length === 1 ? fragment.firstChild : fragment;
}

/**
 * Renders content into a DOM element and optionally binds events.
 *
 * @param {Node|string|null} content
 * @param {Element} element
 * @param {Object} [instance] - Optional ccmjs instance (enables event binding)
 */
export function render(content, element, instance) {
  if (!element) return;

  element.replaceChildren();

  if (content == null) return;

  if (typeof content === "string") {
    element.innerHTML = content;
    return;
  }

  if (content instanceof Node) {
    // automatic event binding (internal)
    bind(content, instance);

    element.appendChild(content);
  }
}

/**
 * Binds declarative DOM events to instance actions.
 *
 * Convention:
 *   data-on-click="next"
 *   data-on-input="typing"
 *
 * Behavior:
 * - Calls instance.events[actionName] (if defined)
 */
export function bind(root, instance) {
  if (!root || !instance) return;

  const handlers = instance.events || {};

  const elements = [root, ...root.querySelectorAll("*")];
  elements.forEach((el) => {
    [...el.attributes].forEach((attr) => {
      if (!attr.name.startsWith("data-on-")) return;

      const eventType = attr.name.slice(8);
      const actionName = attr.value;

      el.addEventListener(eventType, (event) => handlers[actionName]?.(event));
    });
  });
}
