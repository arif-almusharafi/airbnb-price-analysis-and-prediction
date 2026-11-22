// Pure helpers for the model results (data/model_results.json).
// No DOM here, so Node tests can load it. The drawing is in results-view.js.
(function (root) {
  const STAGES = [
    { key: "original", label: "Original" },
    { key: "fixed", label: "Bug fixes" },
    { key: "tuned", label: "Tuned" },
  ];

  const METRICS = {
    r2: { label: "R²", better: "higher" },
    mae: { label: "MAE", better: "lower" },
    rmse: { label: "RMSE", better: "lower" },
  };

  const MODEL_ORDER = [
    "LinearRegression",
    "RandomForestRegressor",
    "KNeighborsRegressor",
    "GradientBoostingRegressor",
    "SVR",
  ];

  // Returns the number, or null when the stage is still pending.
  function stageValue(model, stageKey, metricKey) {
    const stage = model[stageKey];
    if (!stage || typeof stage[metricKey] !== "number") {
      return null;
    }
    return stage[metricKey];
  }

  // Basic shape check, so a broken file shows an error instead of a broken table.
  function isValidResults(data) {
    if (!data || !Array.isArray(data.models) || data.models.length !== MODEL_ORDER.length) {
      return false;
    }
    return data.models.every((model, index) => {
      return (
        model.name === MODEL_ORDER[index] &&
        typeof model.label === "string" &&
        model.original &&
        typeof model.original.r2 === "number"
      );
    });
  }

  // The model with the highest tuned R², or null while tuned numbers are pending.
  function bestTunedModelName(models) {
    let best = null;
    models.forEach((model) => {
      const r2 = stageValue(model, "tuned", "r2");
      if (r2 !== null && (best === null || r2 > best.r2)) {
        best = { name: model.name, r2 };
      }
    });
    return best ? best.name : null;
  }

  // Plain sentences about R² going down, so the page says it honestly.
  function describeR2Drops(models) {
    const notes = [];
    models.forEach((model) => {
      const original = stageValue(model, "original", "r2");
      const fixed = stageValue(model, "fixed", "r2");
      const tuned = stageValue(model, "tuned", "r2");
      if (fixed !== null && fixed < original) {
        notes.push(
          model.label + ": R² went down after the bug fixes (" +
            original.toFixed(3) + " to " + fixed.toFixed(3) + ")."
        );
      }
      if (tuned !== null && fixed !== null && tuned < fixed) {
        notes.push(
          model.label + ": R² went down after tuning (" +
            fixed.toFixed(3) + " to " + tuned.toFixed(3) + ")."
        );
      }
    });
    return notes;
  }

  // Labels of the models whose tuned settings differ from the original ones,
  // so the page never says a model was tuned when it was not.
  function tunedModelLabels(models) {
    return models
      .filter((model) => {
        if (!model.tuned) {
          return false;
        }
        return JSON.stringify(model.tuned.params || {}) !== JSON.stringify(model.original.params || {});
      })
      .map((model) => model.label);
  }

  // The note about the model behind the live predictor, built only from the JSON:
  // served_model.reason (one sentence from the backend), then the typical error in dollars.
  // Returns null while the served model is not known yet.
  function servedModelNote(data) {
    const served = data && data.served_model;
    if (!served || !served.name) {
      return null;
    }
    const model = (data.models || []).find((item) => item.name === served.name);
    const label = model ? model.label : served.name;
    const parts = [];
    if (typeof served.reason === "string" && served.reason.trim() !== "") {
      parts.push(served.reason.trim());
    } else {
      parts.push("The live predictor uses the tuned " + label + " model.");
    }
    if (typeof served.mae_dollars === "number") {
      parts.push(
        "On the test listings, " + label + " is off by about $" +
          Math.round(served.mae_dollars).toLocaleString("en-US") + " per night on average."
      );
    }
    return parts.join(" ");
  }

  // True while any "fixed" or "tuned" stage is still null.
  function hasPendingStages(models) {
    return models.some((model) => !model.fixed || !model.tuned);
  }

  // Bar length in percent for the R² chart. The scale is 0 to 1;
  // a negative R² (worse than guessing the average) gets no bar.
  function r2BarPercent(r2) {
    if (typeof r2 !== "number") {
      return 0;
    }
    return Math.round(Math.min(Math.max(r2, 0), 1) * 1000) / 10;
  }

  const ResultsLogic = {
    STAGES,
    METRICS,
    MODEL_ORDER,
    stageValue,
    isValidResults,
    bestTunedModelName,
    describeR2Drops,
    tunedModelLabels,
    servedModelNote,
    hasPendingStages,
    r2BarPercent,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ResultsLogic;
  } else {
    root.ResultsLogic = ResultsLogic;
  }
})(typeof window !== "undefined" ? window : globalThis);
