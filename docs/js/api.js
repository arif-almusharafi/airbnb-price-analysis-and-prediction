// Calls to the backend, exactly as in docs/api-contract.md.
// Every function returns a simple result object and never throws,
// so the page can always show a clear state (online, offline, field errors).
(function (root) {
  const HEALTH_TIMEOUT_MS = 8000; // F4: health gives up after 8 s
  const PREDICT_TIMEOUT_MS = 60000; // F4: predict gives up after 60 s

  function joinUrl(baseUrl, path) {
    return String(baseUrl || "").replace(/\/+$/, "") + path;
  }

  // fetch() with a time limit. Throws on timeout or network failure.
  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  // Returns null when the body is not JSON (for example an HTML page from a
  // sleeping host), so callers can treat it as "offline".
  async function readJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  // GET /api/health
  // -> { online: true, modelName } or { online: false }
  async function checkHealth(baseUrl, timeoutMs = HEALTH_TIMEOUT_MS) {
    try {
      const response = await fetchWithTimeout(
        joinUrl(baseUrl, "/api/health"),
        { method: "GET" },
        timeoutMs
      );
      const data = await readJson(response);
      // "model_loaded: false" counts as offline (api-contract.md).
      if (response.status === 200 && data && data.status === "ok" && data.model_loaded === true) {
        return { online: true, modelName: data.model_name };
      }
      return { online: false };
    } catch (error) {
      return { online: false };
    }
  }

  // POST /api/predict
  // -> { kind: "success", data }                     on 200
  // -> { kind: "validation", message, fields: [...] } on 422
  // -> { kind: "offline" }                            on anything else (timeout, network, 5xx...)
  async function predictPrice(baseUrl, body, timeoutMs = PREDICT_TIMEOUT_MS) {
    try {
      const response = await fetchWithTimeout(
        joinUrl(baseUrl, "/api/predict"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        timeoutMs
      );
      const data = await readJson(response);

      if (response.status === 200 && data && typeof data.predicted_price === "number") {
        return { kind: "success", data };
      }
      if (response.status === 422 && data && data.error) {
        return {
          kind: "validation",
          message: data.error.message || "Some fields are not valid.",
          fields: Array.isArray(data.error.fields) ? data.error.fields : [],
        };
      }
      return { kind: "offline" };
    } catch (error) {
      return { kind: "offline" };
    }
  }

  const Api = {
    HEALTH_TIMEOUT_MS,
    PREDICT_TIMEOUT_MS,
    joinUrl,
    checkHealth,
    predictPrice,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Api;
  } else {
    root.Api = Api;
  }
})(typeof window !== "undefined" ? window : globalThis);
