// Tiny DOM helper: el("p", { className: "note" }, ["Hello"]).
// Text is always added as text (never as HTML), so data cannot inject markup.
(function (root) {
  function el(tag, props, children) {
    const node = document.createElement(tag);
    Object.entries(props || {}).forEach(([key, value]) => {
      if (key === "className") {
        node.className = value;
      } else if (key === "dataset") {
        Object.assign(node.dataset, value);
      } else {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach((child) => {
      if (child === null || child === undefined) {
        return;
      }
      node.append(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  // Inline SVG icon from the <svg><symbol> sprite in index.html.
  function icon(name, className) {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "icon " + (className || ""));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(svgNs, "use");
    use.setAttribute("href", "#icon-" + name);
    svg.append(use);
    return svg;
  }

  root.Dom = { el, icon };
})(window);
