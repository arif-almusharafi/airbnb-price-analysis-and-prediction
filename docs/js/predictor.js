// The live price predictor (F3, F4, F10): status badge, form, and result panel.
(function (root) {
  const { el, icon } = root.Dom;
  const { formatDollars } = root.Format;
  const { validatePredictForm, BOROUGH_CENTERS } = root.Validate;
  const Api = root.Api;

  const FIELD_NAMES = [
    "neighbourhood_group",
    "room_type",
    "minimum_nights",
    "number_of_reviews",
    "calculated_host_listings_count",
    "availability_365",
    "latitude",
    "longitude",
  ];

  const ASLEEP_MESSAGE =
    "The live predictor is asleep (free hosting). It usually wakes up in about a minute. Please try again.";

  // What "Try again" should repeat: the health check or the last prediction.
  let lastFailed = "health";
  // True while a prediction request is running.
  let predicting = false;

  function baseUrl() {
    return (root.APP_CONFIG && root.APP_CONFIG.API_BASE_URL) || "";
  }

  function field(name) {
    return document.getElementById("field-" + name);
  }

  // ---------- Status badge ----------

  const STATUS = {
    waking: { text: "Waking up...", iconName: "clock" },
    online: { text: "Predictor online", iconName: "check" },
    offline: { text: "Predictor offline", iconName: "moon" },
  };

  function setStatus(state) {
    const badge = document.getElementById("api-status");
    const info = STATUS[state];
    badge.dataset.state = state;
    badge.replaceChildren(icon(info.iconName), el("span", {}, [info.text]));
  }

  // ---------- Result panel ----------

  function showPanel(name) {
    ["idle", "loading", "result", "asleep"].forEach((panel) => {
      document.getElementById("predict-" + panel).hidden = panel !== name;
    });
  }

  function showResult(data) {
    document.getElementById("result-price").textContent = formatDollars(data.predicted_price);

    const range = document.getElementById("result-range");
    if (data.price_range && typeof data.price_range.low === "number") {
      range.textContent =
        "Likely range: " + formatDollars(data.price_range.low) + " to " + formatDollars(data.price_range.high);
      range.hidden = false;
    } else {
      range.hidden = true;
    }

    const used = data.input || {};
    const where =
      data.location_source === "user" ? "your coordinates" : "the center of " + used.neighbourhood_group;
    document.getElementById("result-details").textContent =
      used.room_type + " in " + used.neighbourhood_group + ", location from " + where + ".";

    showPanel("result");
  }

  function showAsleep(failedAction) {
    lastFailed = failedAction;
    setStatus("offline");
    showPanel("asleep");
  }

  // ---------- Field errors ----------

  function clearErrors() {
    FIELD_NAMES.forEach((name) => setFieldError(name, ""));
    document.getElementById("form-error").hidden = true;
  }

  function setFieldError(name, message) {
    const input = field(name);
    const error = document.getElementById("error-" + name);
    if (!input || !error) {
      return;
    }
    error.replaceChildren(message ? icon("alert") : "", message);
    error.hidden = !message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  // Shows errors next to the fields and moves focus to the first one.
  function showErrors(errors) {
    const names = FIELD_NAMES.filter((name) => errors[name]);
    names.forEach((name) => setFieldError(name, errors[name]));
    // Open "Advanced" if the problem is inside it, so the visitor can see it.
    if (errors.latitude || errors.longitude) {
      document.getElementById("advanced").open = true;
    }
    if (names.length > 0) {
      field(names[0]).focus();
    }
  }

  function showFormError(message) {
    const box = document.getElementById("form-error");
    box.replaceChildren(icon("alert"), el("span", {}, [message]));
    box.hidden = false;
  }

  // ---------- Actions ----------

  function readForm() {
    const raw = {};
    FIELD_NAMES.forEach((name) => {
      const input = field(name);
      // A number input holding text like "abc" reports value "" and badInput.
      raw[name] = input.validity && input.validity.badInput ? "not a number" : input.value;
    });
    return raw;
  }

  function setBusy(isBusy) {
    const button = document.getElementById("predict-button");
    button.disabled = isBusy;
    button.setAttribute("aria-busy", String(isBusy));
  }

  async function wakeApi() {
    setStatus("waking");
    const health = await Api.checkHealth(baseUrl());
    if (health.online) {
      setStatus("online");
      // Hide the "asleep" message once the API answers.
      if (!document.getElementById("predict-asleep").hidden) {
        showPanel("idle");
      }
    } else if (predicting) {
      // A prediction is still running and may wake the server: only update the badge.
      setStatus("offline");
    } else {
      showAsleep("health");
    }
  }

  async function predict() {
    if (predicting) {
      return;
    }
    clearErrors();
    const { body, errors } = validatePredictForm(readForm());
    if (Object.keys(errors).length > 0) {
      showErrors(errors);
      return;
    }

    predicting = true;
    setBusy(true);
    showPanel("loading");
    const answer = await Api.predictPrice(baseUrl(), body);
    predicting = false;
    setBusy(false);

    if (answer.kind === "success") {
      setStatus("online");
      showResult(answer.data);
    } else if (answer.kind === "validation") {
      setStatus("online");
      showPanel("idle");
      const fieldErrors = {};
      answer.fields.forEach((item) => {
        if (FIELD_NAMES.includes(item.field)) {
          fieldErrors[item.field] = item.message;
        }
      });
      if (Object.keys(fieldErrors).length > 0) {
        showErrors(fieldErrors);
      } else {
        showFormError(answer.message);
      }
    } else {
      showAsleep("predict");
    }
  }

  function retry() {
    if (lastFailed === "predict") {
      predict();
    } else {
      wakeApi();
    }
  }

  // The coordinate placeholders follow the chosen borough.
  function updateCoordinatePlaceholders() {
    const center = BOROUGH_CENTERS[field("neighbourhood_group").value];
    if (center) {
      field("latitude").placeholder = String(center.latitude);
      field("longitude").placeholder = String(center.longitude);
    }
  }

  function init() {
    const form = document.getElementById("predict-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      predict();
    });
    document.getElementById("predict-retry").addEventListener("click", retry);
    field("neighbourhood_group").addEventListener("change", updateCoordinatePlaceholders);
    updateCoordinatePlaceholders();
    // One call when the page loads, to wake the free-tier server (F4).
    wakeApi();
  }

  root.Predictor = { init };
})(window);
