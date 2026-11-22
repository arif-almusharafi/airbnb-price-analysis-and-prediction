// Draws the "Model results" section from data/model_results.json:
// the R² bar chart (F11), the results table (F2), "What changed", and the notes.
// The file is static, so this works even when the API is asleep (F4).
(function (root) {
  const { el, icon } = root.Dom;
  const { formatMetric, formatParams } = root.Format;
  const Logic = root.ResultsLogic;

  const RESULTS_URL = "data/model_results.json";

  function pendingText() {
    return el("span", { className: "pending" }, ["Pending"]);
  }

  function bestBadge() {
    return el("span", { className: "badge-best" }, [icon("star"), "Best"]);
  }

  // One cell value: the number, or "Pending".
  function valueNode(model, stageKey, metricKey) {
    const text = formatMetric(Logic.stageValue(model, stageKey, metricKey));
    return text === null ? pendingText() : el("span", { className: "num" }, [text]);
  }

  // ---------- R² chart (F11) ----------

  function renderChart(models, bestName) {
    const list = document.getElementById("r2-chart");
    list.replaceChildren();

    models.forEach((model) => {
      const rows = Logic.STAGES.map((stage) => {
        const r2 = Logic.stageValue(model, stage.key, "r2");
        const isBest = stage.key === "tuned" && model.name === bestName;
        const fill = el("span", { className: "bar-fill bar-fill--" + stage.key });
        fill.style.transform = "scaleX(" + Logic.r2BarPercent(r2) / 100 + ")";

        let valueText;
        if (r2 === null) {
          valueText = pendingText();
        } else if (r2 < 0) {
          valueText = el("span", { className: "num" }, [formatMetric(r2) + " (below 0)"]);
        } else {
          valueText = el("span", { className: "num" }, [formatMetric(r2)]);
        }

        return el("div", { className: "bar-row" + (isBest ? " is-best" : "") }, [
          el("span", { className: "bar-label" }, [stage.label]),
          el("span", { className: "bar-track", "aria-hidden": "true" }, [fill]),
          el("span", { className: "bar-value" }, [valueText, isBest ? bestBadge() : null]),
        ]);
      });

      list.append(
        el("li", { className: "chart-group" }, [
          el("p", { className: "chart-model" }, [model.label]),
          ...rows,
        ])
      );
    });
  }

  // ---------- Results table (F2) ----------

  function buildSingleMetricTable(models, metricKey, bestName) {
    const metric = Logic.METRICS[metricKey];
    const caption = el("caption", {}, [
      metric.label + " for each model and stage. " +
        (metric.better === "higher" ? "Higher is better." : "Lower is better."),
    ]);

    const head = el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col" }, ["Model"]),
        ...Logic.STAGES.map((stage) => el("th", { scope: "col", className: "num-col" }, [stage.label])),
      ]),
    ]);

    const body = el(
      "tbody",
      {},
      models.map((model) => {
        const isBestRow = metricKey === "r2" && model.name === bestName;
        return el("tr", { className: isBestRow ? "is-best" : "" }, [
          el("th", { scope: "row" }, [model.label]),
          ...Logic.STAGES.map((stage) => {
            const showBadge = isBestRow && stage.key === "tuned";
            // data-label lets the phone layout show the stage name above each value.
            return el("td", { className: "num-col", dataset: { label: stage.label } }, [
              valueNode(model, stage.key, metricKey),
              showBadge ? bestBadge() : null,
            ]);
          }),
        ]);
      })
    );

    return el("table", { className: "results-table" }, [caption, head, body]);
  }

  function buildAllMetricsTable(models, bestName) {
    const metricKeys = ["r2", "mae", "rmse"];
    const caption = el("caption", {}, [
      "All metrics for each model and stage. R²: higher is better. MAE and RMSE: lower is better. " +
        "On a phone, scroll sideways to see every column.",
    ]);

    const topRow = el("tr", {}, [
      el("th", { scope: "col", rowspan: "2" }, ["Model"]),
      ...metricKeys.map((key) =>
        el("th", { scope: "colgroup", colspan: "3", className: "group-start" }, [Logic.METRICS[key].label])
      ),
    ]);
    const stageRow = el(
      "tr",
      {},
      metricKeys.flatMap(() =>
        Logic.STAGES.map((stage, index) =>
          el("th", { scope: "col", className: "num-col" + (index === 0 ? " group-start" : "") }, [stage.label])
        )
      )
    );

    const body = el(
      "tbody",
      {},
      models.map((model) =>
        el("tr", { className: model.name === bestName ? "is-best" : "" }, [
          el("th", { scope: "row" }, [model.label]),
          ...metricKeys.flatMap((metricKey) =>
            Logic.STAGES.map((stage, index) => {
              const showBadge = metricKey === "r2" && stage.key === "tuned" && model.name === bestName;
              return el("td", { className: "num-col" + (index === 0 ? " group-start" : "") }, [
                valueNode(model, stage.key, metricKey),
                showBadge ? bestBadge() : null,
              ]);
            })
          ),
        ])
      )
    );

    return el("table", { className: "results-table results-table--all" }, [
      caption,
      el("thead", {}, [topRow, stageRow]),
      body,
    ]);
  }

  function renderTable(models, metricKey, bestName) {
    const wrap = document.getElementById("results-table-wrap");
    const table =
      metricKey === "all"
        ? buildAllMetricsTable(models, bestName)
        : buildSingleMetricTable(models, metricKey, bestName);
    wrap.replaceChildren(table);
  }

  function setupMetricSwitch(models, bestName) {
    const buttons = document.querySelectorAll("#metric-switch button");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        renderTable(models, button.dataset.metric, bestName);
      });
    });
  }

  // ---------- "What changed" and notes ----------

  function renderChanges(data) {
    const list = document.getElementById("changes-list");
    const items = (data.fixes || []).map((text) => el("li", {}, [text]));
    const tunedLabels = Logic.tunedModelLabels(data.models);
    if (tunedLabels.length > 0) {
      items.push(
        el("li", {}, [
          "Tuning: new settings for " + tunedLabels.join(", ") +
            " (see “Model settings” below). K-Nearest Neighbors and SVR now also scale the features first.",
        ])
      );
    }
    list.replaceChildren(...items);

    const drops = Logic.describeR2Drops(data.models);
    const dropsBox = document.getElementById("r2-drops");
    if (Logic.hasPendingStages(data.models)) {
      dropsBox.replaceChildren(
        el("p", {}, [
          "The numbers after the bug fixes and after tuning are pending. They appear here as soon as the new notebook run is ready.",
        ])
      );
    } else if (drops.length > 0) {
      dropsBox.replaceChildren(
        el("p", {}, ["Where a score got worse:"]),
        el("ul", {}, drops.map((text) => el("li", {}, [text])))
      );
    } else {
      dropsBox.replaceChildren(el("p", {}, ["No model got a lower R² at any stage."]));
    }
  }

  function renderNotes(data) {
    // The same served-model note goes near the results table and near the predictor.
    const servedNote = Logic.servedModelNote(data);
    document.getElementById("mae-dollars-note").textContent =
      servedNote || "The model behind the live predictor and its typical error in dollars will appear here once the tuned model is ready.";
    const predictorNote = document.getElementById("predictor-served-note");
    if (servedNote) {
      document.getElementById("predictor-served-text").textContent = servedNote;
      predictorNote.hidden = false;
    } else {
      predictorNote.hidden = true;
    }

    const split = data.split;
    const splitNote = document.getElementById("split-note");
    if (split && typeof split.test_rows === "number") {
      splitNote.textContent =
        "All scores come from " + split.test_rows.toLocaleString("en-US") +
        " test listings (" + Math.round(split.test_size * 100) + "% of the data) that the models never saw during training.";
    }
  }

  function renderParams(models) {
    const list = document.getElementById("params-list");
    list.replaceChildren(
      ...models.map((model) =>
        el("li", {}, [
          el("strong", {}, [model.label]),
          el("span", {}, ["Original: " + formatParams(model.original.params)]),
          el("span", {}, [
            "Tuned: " + (model.tuned ? formatParams(model.tuned.params) : "pending"),
          ]),
        ])
      )
    );
  }

  // ---------- Loading, error, and success states ----------

  function showState(state) {
    document.getElementById("results-loading").hidden = state !== "loading";
    document.getElementById("results-error").hidden = state !== "error";
    document.getElementById("results-content").hidden = state !== "ready";
  }

  async function loadResults() {
    showState("loading");
    try {
      const response = await fetch(RESULTS_URL, { cache: "no-cache" });
      const data = await response.json();
      if (!response.ok || !Logic.isValidResults(data)) {
        throw new Error("Results file has the wrong shape");
      }
      const bestName = Logic.bestTunedModelName(data.models);
      renderChart(data.models, bestName);
      renderTable(data.models, "r2", bestName);
      setupMetricSwitch(data.models, bestName);
      renderChanges(data);
      renderNotes(data);
      renderParams(data.models);
      showState("ready");
    } catch (error) {
      showState("error");
    }
  }

  function init() {
    document.getElementById("results-retry").addEventListener("click", loadResults);
    return loadResults();
  }

  root.ResultsView = { init };
})(window);
