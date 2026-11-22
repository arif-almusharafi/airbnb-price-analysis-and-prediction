// Small text helpers shared by the page. No DOM here, so Node tests can load it.
(function (root) {
  // 152 -> "$152", 1500 -> "$1,500"
  function formatDollars(amount) {
    return "$" + Math.round(amount).toLocaleString("en-US");
  }

  // 0.6254 -> "0.625", -0.033 -> "-0.033", null -> null
  function formatMetric(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    return value.toFixed(3);
  }

  // { n_estimators: 300, scaled: true } -> "n_estimators=300, scaled=true"
  // {} -> "default settings"
  function formatParams(params) {
    if (!params || Object.keys(params).length === 0) {
      return "default settings";
    }
    return Object.keys(params)
      .map((key) => key + "=" + String(params[key]))
      .join(", ");
  }

  const Format = { formatDollars, formatMetric, formatParams };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Format;
  } else {
    root.Format = Format;
  }
})(typeof window !== "undefined" ? window : globalThis);
