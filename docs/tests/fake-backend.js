// A tiny fake of the prediction API (docs/api-contract.md), only for trying the
// page when the real backend is not ready. The prices are made up, not a model.
// Run from frontend/: node tests/fake-backend.js   (stop the real backend first: same port)
// Add --slow to wait 3 s before each answer (to see the loading state).
// Add --port 8110 to use another port (then change js/config.js to match).
const http = require("node:http");

const portIndex = process.argv.indexOf("--port");
const PORT = portIndex > -1 ? Number(process.argv[portIndex + 1]) : 8100;
const SLOW = process.argv.includes("--slow");
const CENTERS = {
  Bronx: [40.8472, -73.8901],
  Brooklyn: [40.687, -73.9517],
  Manhattan: [40.7616, -73.98],
  Queens: [40.745, -73.8913],
  "Staten Island": [40.6233, -74.089],
};
const ROOM_BASE = { "Entire home/apt": 180, "Private room": 80, "Shared room": 50 };

function send(res, status, body) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(body));
}

function fieldError(field, message) {
  return { error: { code: "validation_error", message: "Some fields are not valid.", fields: [{ field, message }] } };
}

function predict(input) {
  if (!CENTERS[input.neighbourhood_group]) {
    return [422, fieldError("neighbourhood_group", "Must be one of the five boroughs.")];
  }
  if (!Number.isInteger(input.minimum_nights) || input.minimum_nights < 1 || input.minimum_nights > 365) {
    return [422, fieldError("minimum_nights", "Must be a whole number from 1 to 365.")];
  }
  const fromUser = typeof input.latitude === "number" && typeof input.longitude === "number";
  const [lat, lon] = fromUser ? [input.latitude, input.longitude] : CENTERS[input.neighbourhood_group];
  const price = Math.round((ROOM_BASE[input.room_type] || 100) * (input.neighbourhood_group === "Manhattan" ? 1.3 : 1));
  return [
    200,
    {
      predicted_price: price,
      price_range: { low: Math.round(price * 0.75), high: Math.round(price * 1.34) },
      currency: "USD",
      per: "night",
      model_name: "FakeModel",
      location_source: fromUser ? "user" : "borough_center",
      input: { ...input, latitude: lat, longitude: lon },
    },
  ];
}

http
  .createServer((req, res) => {
    if (req.method === "OPTIONS") {
      return send(res, 204, {});
    }
    const wait = SLOW ? 3000 : 0;
    if (req.method === "GET" && req.url === "/api/health") {
      return setTimeout(() => send(res, 200, { status: "ok", model_loaded: true, model_name: "FakeModel" }), wait);
    }
    if (req.method === "POST" && req.url === "/api/predict") {
      let text = "";
      req.on("data", (chunk) => (text += chunk));
      req.on("end", () => {
        let input;
        try {
          input = JSON.parse(text);
        } catch (error) {
          return send(res, 400, { error: { code: "bad_json", message: "The body is not valid JSON.", fields: [] } });
        }
        const [status, body] = predict(input);
        setTimeout(() => send(res, status, body), wait);
      });
      return;
    }
    send(res, 404, { error: { code: "not_found", message: "Not found.", fields: [] } });
  })
  .listen(PORT, "127.0.0.1", () => console.log("Fake API on http://127.0.0.1:" + PORT + (SLOW ? " (slow)" : "")));
