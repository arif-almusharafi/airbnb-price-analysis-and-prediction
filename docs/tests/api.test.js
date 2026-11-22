// Tests for js/api.js with a fake fetch (no backend needed).
// Run from frontend/: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const Api = require("../js/api.js");

const BASE = "http://127.0.0.1:8100";

// Replace fetch with a fake that records each call and returns the given answer.
// body === undefined means "not JSON" (like an HTML page from a sleeping host).
function fakeFetch(status, body) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => {
        if (body === undefined) {
          throw new SyntaxError("Unexpected token <");
        }
        return body;
      },
    };
  };
  return calls;
}

// A fetch that never answers, but stops when the timeout aborts it.
function hangingFetch() {
  globalThis.fetch = (url, options) =>
    new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
}

test("timeouts match the requirements (8 s health, 60 s predict)", () => {
  assert.equal(Api.HEALTH_TIMEOUT_MS, 8000);
  assert.equal(Api.PREDICT_TIMEOUT_MS, 60000);
});

test("joinUrl removes a trailing slash from the base URL", () => {
  assert.equal(Api.joinUrl("https://x.onrender.com/", "/api/health"), "https://x.onrender.com/api/health");
});

test("health: GET /api/health with model_loaded true is online", async () => {
  const calls = fakeFetch(200, { status: "ok", model_loaded: true, model_name: "RandomForestRegressor" });
  const result = await Api.checkHealth(BASE);
  assert.deepEqual(result, { online: true, modelName: "RandomForestRegressor" });
  assert.equal(calls[0].url, BASE + "/api/health");
  assert.equal(calls[0].options.method, "GET");
});

test("health: model_loaded false counts as offline", async () => {
  fakeFetch(200, { status: "ok", model_loaded: false, model_name: null });
  assert.deepEqual(await Api.checkHealth(BASE), { online: false });
});

test("health: an HTML error page counts as offline", async () => {
  fakeFetch(502, undefined);
  assert.deepEqual(await Api.checkHealth(BASE), { online: false });
});

test("health: a network failure counts as offline", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  assert.deepEqual(await Api.checkHealth(BASE), { online: false });
});

test("health: no answer before the timeout counts as offline", async () => {
  hangingFetch();
  assert.deepEqual(await Api.checkHealth(BASE, 20), { online: false });
});

test("predict: POST /api/predict sends JSON and returns the price", async () => {
  const answer = {
    predicted_price: 152,
    price_range: { low: 113, high: 204 },
    currency: "USD",
    per: "night",
    model_name: "RandomForestRegressor",
    location_source: "borough_center",
    input: {},
  };
  const calls = fakeFetch(200, answer);
  const body = { neighbourhood_group: "Manhattan", minimum_nights: 2 };
  const result = await Api.predictPrice(BASE, body);

  assert.equal(result.kind, "success");
  assert.equal(result.data.predicted_price, 152);
  assert.equal(calls[0].url, BASE + "/api/predict");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), body);
});

test("predict: 422 returns the field messages from the contract's error shape", async () => {
  fakeFetch(422, {
    error: {
      code: "validation_error",
      message: "Some fields are not valid.",
      fields: [{ field: "minimum_nights", message: "Must be a whole number from 1 to 365." }],
    },
  });
  const result = await Api.predictPrice(BASE, {});
  assert.equal(result.kind, "validation");
  assert.equal(result.fields[0].field, "minimum_nights");
});

test("predict: 503 and 500 count as offline (no raw error text)", async () => {
  fakeFetch(503, { error: { code: "model_unavailable", message: "x", fields: [] } });
  assert.deepEqual(await Api.predictPrice(BASE, {}), { kind: "offline" });
  fakeFetch(500, undefined);
  assert.deepEqual(await Api.predictPrice(BASE, {}), { kind: "offline" });
});

test("predict: no answer before the timeout counts as offline", async () => {
  hangingFetch();
  assert.deepEqual(await Api.predictPrice(BASE, {}, 20), { kind: "offline" });
});
