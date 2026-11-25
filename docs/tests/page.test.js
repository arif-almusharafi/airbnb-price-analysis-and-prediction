// Checks on index.html itself: section order, language, links, and local files.
// Run from frontend/: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("the page is English, left to right, and has a phone viewport", () => {
  assert.match(html, /<html lang="en" dir="ltr">/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
});

test("sections come in the order the Requirements ask for", () => {
  const ids = ["top", "goal", "dataset", "workflow", "charts", "results", "predictor", "limitations", "author"];
  const positions = ids.map((id) => html.indexOf('id="' + id + '"'));
  positions.forEach((position, i) => assert.ok(position > 0, "missing section " + ids[i]));
  const sorted = [...positions].sort((a, b) => a - b);
  assert.deepEqual(positions, sorted);
});

test("hero has the two buttons", () => {
  assert.match(html, /Try the predictor/);
  assert.match(html, /View on GitHub/);
});

test("every local file the page uses exists (no broken images)", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 10);
  refs.forEach((ref) => assert.ok(fs.existsSync(path.join(root, ref)), "missing file: " + ref));
});

test("all images are lazy-loaded and have size and alt text", () => {
  const images = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(images.length >= 3, "at least 3 charts");
  images.forEach((img) => {
    assert.match(img, /loading="lazy"/);
    assert.match(img, /width="\d+"/);
    assert.match(img, /height="\d+"/);
    assert.match(img, /alt="[^"]{10,}"/);
  });
});

test("author links open in a new tab", () => {
  [
    "https://www.linkedin.com/in/arif-almishrafi-45612b2a7",
    "https://github.com/arif-almusharafi",
    "https://github.com/arif-almusharafi/airbnb-price-analysis-and-prediction",
  ].forEach((url) => {
    const pattern = new RegExp('href="' + url.replace(/[.\/]/g, "\\$&") + '" target="_blank" rel="noopener noreferrer"');
    assert.match(html, pattern, url);
  });
});

test("every form input has a visible label", () => {
  const ids = [...html.matchAll(/<(?:input|select)\b[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, 8);
  ids.forEach((id) => assert.match(html, new RegExp('<label for="' + id + '">'), id));
});

test("the API base URL is set only in js/config.js", () => {
  const config = fs.readFileSync(path.join(root, "js", "config.js"), "utf8");
  assert.match(config, /API_BASE_URL: "https?:\/\/[^"\s]+[^\/"\s]"/); // set, with no slash at the end
  ["api.js", "predictor.js", "results-view.js", "main.js"].forEach((file) => {
    const code = fs.readFileSync(path.join(root, "js", file), "utf8");
    assert.doesNotMatch(code, /127\.0\.0\.1|localhost|onrender/, file);
  });
});

test("Open Graph tags are present (LinkedIn preview)", () => {
  ["og:title", "og:description", "og:image", "og:url"].forEach((name) => {
    assert.match(html, new RegExp('property="' + name + '" content="[^"]+"'), name);
  });
});
