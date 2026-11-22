// Tests for js/results-logic.js, js/format.js, and the shared data/model_results.json.
// Run from frontend/: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Logic = require("../js/results-logic.js");
const Format = require("../js/format.js");

const resultsFile = path.join(__dirname, "..", "data", "model_results.json");
const results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));

function model(name, label, original, fixed, tuned) {
  return {
    name,
    label,
    original: { params: {}, ...original },
    fixed: fixed && { params: {}, ...fixed },
    tuned: tuned && { params: {}, ...tuned },
  };
}

test("model_results.json has the shape from the API contract", () => {
  assert.equal(results.target, "log1p(price)");
  assert.ok(Logic.isValidResults(results));
  assert.deepEqual(
    results.models.map((m) => m.label),
    ["Linear Regression", "Random Forest", "K-Nearest Neighbors", "Gradient Boosting", "SVR"]
  );
  assert.ok(Array.isArray(results.fixes));
});

test("the Original stage matches the README table exactly", () => {
  const expected = {
    LinearRegression: [0.338, 0.455, 0.527],
    RandomForestRegressor: [0.293, 0.405, 0.625],
    KNeighborsRegressor: [0.53, 0.672, -0.033],
    GradientBoostingRegressor: [0.304, 0.415, 0.606],
    SVR: [0.522, 0.658, 0.01],
  };
  results.models.forEach((m) => {
    assert.deepEqual([m.original.mae, m.original.rmse, m.original.r2], expected[m.name], m.name);
  });
  const knn = results.models.find((m) => m.name === "KNeighborsRegressor");
  assert.deepEqual(knn.original.params, { n_neighbors: 15 });
});

test("isValidResults rejects a wrong file", () => {
  assert.equal(Logic.isValidResults(null), false);
  assert.equal(Logic.isValidResults({ models: [] }), false);
});

test("stageValue returns null for a pending stage", () => {
  const m = model("SVR", "SVR", { r2: 0.01 }, null, null);
  assert.equal(Logic.stageValue(m, "original", "r2"), 0.01);
  assert.equal(Logic.stageValue(m, "tuned", "r2"), null);
});

test("best tuned model is null while pending, then the highest tuned R²", () => {
  const pending = [model("A", "A", { r2: 0.6 }, null, null)];
  assert.equal(Logic.bestTunedModelName(pending), null);
  assert.equal(Logic.hasPendingStages(pending), true);

  const ready = [
    model("A", "A", { r2: 0.6 }, { r2: 0.6 }, { r2: 0.61 }),
    model("B", "B", { r2: 0.5 }, { r2: 0.5 }, { r2: 0.63 }),
  ];
  assert.equal(Logic.bestTunedModelName(ready), "B");
  assert.equal(Logic.hasPendingStages(ready), false);
});

test("R² drops are described in plain words", () => {
  const models = [
    model("A", "Random Forest", { r2: 0.625 }, { r2: 0.62 }, { r2: 0.632 }),
    model("B", "SVR", { r2: 0.01 }, { r2: 0.3 }, { r2: 0.2 }),
  ];
  assert.deepEqual(Logic.describeR2Drops(models), [
    "Random Forest: R² went down after the bug fixes (0.625 to 0.620).",
    "SVR: R² went down after tuning (0.300 to 0.200).",
  ]);
});

test("bar width: 0 to 100 percent, negative R² gets no bar", () => {
  assert.equal(Logic.r2BarPercent(0.625), 62.5);
  assert.equal(Logic.r2BarPercent(-0.033), 0);
  assert.equal(Logic.r2BarPercent(1.2), 100);
  assert.equal(Logic.r2BarPercent(null), 0);
});

test("format helpers", () => {
  assert.equal(Format.formatDollars(152), "$152");
  assert.equal(Format.formatDollars(1500), "$1,500");
  assert.equal(Format.formatMetric(0.62), "0.620");
  assert.equal(Format.formatMetric(-0.033), "-0.033");
  assert.equal(Format.formatMetric(null), null);
  assert.equal(Format.formatParams({}), "default settings");
  assert.equal(Format.formatParams({ n_estimators: 300, scaled: true }), "n_estimators=300, scaled=true");
});

test("tunedModelLabels lists only models whose settings changed", () => {
  const models = [
    model("A", "Linear Regression", { r2: 0.5 }, { r2: 0.5 }, { r2: 0.5 }),
    model("B", "Random Forest", { r2: 0.6 }, { r2: 0.6 }, { r2: 0.62, params: { n_estimators: 300 } }),
  ];
  assert.deepEqual(Logic.tunedModelLabels(models), ["Random Forest"]);
});

test("with the real results file: no pending stage, honest notes, a best model", () => {
  if (Logic.hasPendingStages(results.models)) {
    return; // still the placeholder file
  }
  assert.ok(results.served_model && typeof results.served_model.mae_dollars === "number");
  const best = Logic.bestTunedModelName(results.models);
  assert.ok(best);
  // Every R² drop must be reported in plain words.
  results.models.forEach((m) => {
    if (m.fixed.r2 < m.original.r2) {
      assert.ok(Logic.describeR2Drops(results.models).some((t) => t.startsWith(m.label + ": R² went down after the bug fixes")));
    }
  });
});

test("servedModelNote uses the reason and the error from the JSON", () => {
  const data = {
    models: [model("GradientBoostingRegressor", "Gradient Boosting", { r2: 0.6 }, null, null)],
    served_model: {
      name: "GradientBoostingRegressor",
      mae_log: 0.298,
      mae_dollars: 49,
      fallback_used: true,
      reason: "The live predictor uses Gradient Boosting (R² 0.620). It is much smaller and fits free hosting.",
    },
  };
  assert.equal(
    Logic.servedModelNote(data),
    "The live predictor uses Gradient Boosting (R² 0.620). It is much smaller and fits free hosting. " +
      "On the test listings, Gradient Boosting is off by about $49 per night on average."
  );
  assert.equal(Logic.servedModelNote({ models: [], served_model: null }), null);
});

test("without a reason, the note still names the served model from the JSON", () => {
  const data = { models: [], served_model: { name: "SVR", mae_dollars: 60 } };
  assert.match(Logic.servedModelNote(data), /^The live predictor uses the tuned SVR model\./);
});
