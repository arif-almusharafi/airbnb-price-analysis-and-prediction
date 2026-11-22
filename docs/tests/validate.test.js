// Tests for js/validate.js (the browser check before POST /api/predict).
// Run from frontend/: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const Validate = require("../js/validate.js");

function form(changes) {
  return { ...Validate.DEFAULTS, ...changes };
}

test("the contract defaults are valid and send null coordinates", () => {
  const { body, errors } = Validate.validatePredictForm(form({}));
  assert.deepEqual(errors, {});
  assert.deepEqual(body, {
    neighbourhood_group: "Manhattan",
    room_type: "Entire home/apt",
    minimum_nights: 2,
    number_of_reviews: 9,
    calculated_host_listings_count: 1,
    availability_365: 55,
    latitude: null,
    longitude: null,
  });
});

test("whole numbers: 2.0 is accepted as 2, 2.5 and text are rejected", () => {
  assert.equal(Validate.parseWholeNumber("2.0"), 2);
  assert.equal(Validate.parseWholeNumber(" 7 "), 7);
  assert.equal(Validate.parseWholeNumber("2.5"), null);
  assert.equal(Validate.parseWholeNumber("abc"), null);
  assert.equal(Validate.parseWholeNumber(""), null);
});

test("out of range numbers get a message next to the field", () => {
  const { errors } = Validate.validatePredictForm(
    form({ minimum_nights: "0", number_of_reviews: "701", calculated_host_listings_count: "351", availability_365: "366" })
  );
  assert.equal(errors.minimum_nights, "Must be a whole number from 1 to 365.");
  assert.equal(errors.number_of_reviews, "Must be a whole number from 0 to 700.");
  assert.equal(errors.calculated_host_listings_count, "Must be a whole number from 1 to 350.");
  assert.equal(errors.availability_365, "Must be a whole number from 0 to 365.");
});

test("range edges are allowed", () => {
  const { errors } = Validate.validatePredictForm(
    form({ minimum_nights: "365", number_of_reviews: "0", calculated_host_listings_count: "350", availability_365: "0" })
  );
  assert.deepEqual(errors, {});
});

test("an empty whole number field is an error", () => {
  const { errors } = Validate.validatePredictForm(form({ minimum_nights: "" }));
  assert.ok(errors.minimum_nights);
});

test("only one coordinate is an error on the empty one", () => {
  const { errors } = Validate.validatePredictForm(form({ latitude: "40.7" }));
  assert.equal(errors.longitude, "Enter both latitude and longitude, or leave both empty.");
  assert.equal(errors.latitude, undefined);
});

test("both coordinates in range are sent as numbers", () => {
  const { body, errors } = Validate.validatePredictForm(form({ latitude: "40.7", longitude: "-73.95" }));
  assert.deepEqual(errors, {});
  assert.equal(body.latitude, 40.7);
  assert.equal(body.longitude, -73.95);
});

test("coordinates out of range are rejected", () => {
  const { errors } = Validate.validatePredictForm(form({ latitude: "41", longitude: "-73.5" }));
  assert.equal(errors.latitude, "Must be a number from 40.49 to 40.92.");
  assert.equal(errors.longitude, "Must be a number from -74.26 to -73.70.");
});

test("unknown borough or room type is rejected", () => {
  const { errors } = Validate.validatePredictForm(form({ neighbourhood_group: "manhattan", room_type: "Hotel" }));
  assert.ok(errors.neighbourhood_group);
  assert.ok(errors.room_type);
});

test("every borough has a center from the contract", () => {
  Validate.BOROUGHS.forEach((name) => assert.ok(Validate.BOROUGH_CENTERS[name], name));
  assert.deepEqual(Validate.BOROUGH_CENTERS.Manhattan, { latitude: 40.7616, longitude: -73.98 });
});
