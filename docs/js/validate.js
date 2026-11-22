// Checks the predictor form in the browser before anything is sent.
// The rules match the "POST /api/predict" table in docs/api-contract.md.
(function (root) {
  const BOROUGHS = ["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"];
  const ROOM_TYPES = ["Entire home/apt", "Private room", "Shared room"];

  // Fixed borough centers from the API contract. Shown as placeholders only.
  const BOROUGH_CENTERS = {
    Bronx: { latitude: 40.8472, longitude: -73.8901 },
    Brooklyn: { latitude: 40.687, longitude: -73.9517 },
    Manhattan: { latitude: 40.7616, longitude: -73.98 },
    Queens: { latitude: 40.745, longitude: -73.8913 },
    "Staten Island": { latitude: 40.6233, longitude: -74.089 },
  };

  const WHOLE_NUMBER_FIELDS = [
    { name: "minimum_nights", min: 1, max: 365 },
    { name: "number_of_reviews", min: 0, max: 700 },
    { name: "calculated_host_listings_count", min: 1, max: 350 },
    { name: "availability_365", min: 0, max: 365 },
  ];

  const LATITUDE = { name: "latitude", min: 40.49, max: 40.92 };
  const LONGITUDE = { name: "longitude", min: -74.26, max: -73.7 };

  // The default form values from the API contract.
  const DEFAULTS = {
    neighbourhood_group: "Manhattan",
    room_type: "Entire home/apt",
    minimum_nights: "2",
    number_of_reviews: "9",
    calculated_host_listings_count: "1",
    availability_365: "55",
    latitude: "",
    longitude: "",
  };

  function wholeNumberMessage(rule) {
    return "Must be a whole number from " + rule.min + " to " + rule.max + ".";
  }

  function decimalMessage(rule) {
    return "Must be a number from " + rule.min.toFixed(2) + " to " + rule.max.toFixed(2) + ".";
  }

  // "2" -> 2, "2.0" -> 2, "2.5" -> null, "" -> null, "abc" -> null
  function parseWholeNumber(text) {
    const value = String(text === undefined || text === null ? "" : text).trim();
    if (!/^-?\d+(\.0+)?$/.test(value)) {
      return null;
    }
    return Math.trunc(Number(value));
  }

  // "40.7" -> 40.7, "-73.98" -> -73.98, "" -> null, "abc" -> null
  function parseDecimal(text) {
    const value = String(text === undefined || text === null ? "" : text).trim();
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(value)) {
      return null;
    }
    return Number(value);
  }

  function isBlank(text) {
    return String(text === undefined || text === null ? "" : text).trim() === "";
  }

  // raw: an object of form strings, keyed by API field name.
  // Returns { body, errors }. "errors" maps field name -> message.
  // "body" is the JSON body for POST /api/predict (only use it when errors is empty).
  function validatePredictForm(raw) {
    const errors = {};
    const body = {};

    if (BOROUGHS.includes(raw.neighbourhood_group)) {
      body.neighbourhood_group = raw.neighbourhood_group;
    } else {
      errors.neighbourhood_group = "Choose one of the five boroughs.";
    }

    if (ROOM_TYPES.includes(raw.room_type)) {
      body.room_type = raw.room_type;
    } else {
      errors.room_type = "Choose a room type.";
    }

    WHOLE_NUMBER_FIELDS.forEach((rule) => {
      const number = parseWholeNumber(raw[rule.name]);
      if (number === null || number < rule.min || number > rule.max) {
        errors[rule.name] = wholeNumberMessage(rule);
      } else {
        body[rule.name] = number;
      }
    });

    // Latitude and longitude are optional, but they come together.
    const latBlank = isBlank(raw.latitude);
    const lonBlank = isBlank(raw.longitude);
    if (latBlank && lonBlank) {
      body.latitude = null;
      body.longitude = null;
    } else if (latBlank || lonBlank) {
      const missing = latBlank ? "latitude" : "longitude";
      errors[missing] = "Enter both latitude and longitude, or leave both empty.";
    } else {
      [LATITUDE, LONGITUDE].forEach((rule) => {
        const number = parseDecimal(raw[rule.name]);
        if (number === null || number < rule.min || number > rule.max) {
          errors[rule.name] = decimalMessage(rule);
        } else {
          body[rule.name] = number;
        }
      });
    }

    return { body, errors };
  }

  const Validate = {
    BOROUGHS,
    ROOM_TYPES,
    BOROUGH_CENTERS,
    DEFAULTS,
    parseWholeNumber,
    parseDecimal,
    validatePredictForm,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Validate;
  } else {
    root.Validate = Validate;
  }
})(typeof window !== "undefined" ? window : globalThis);
