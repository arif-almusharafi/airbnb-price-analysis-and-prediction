# Airbnb Price Analysis: project page (static HTML, CSS, JS)

- Install: nothing. Plain files, no build step. The API URL is set only in `js/config.js` (default `http://127.0.0.1:8100`).
- Run (from this `docs/` folder): `python -m http.server 5200 --bind 127.0.0.1`, then open http://127.0.0.1:5200
- Test (Node 22+, from this folder): `node --test`. No backend? `node tests/fake-backend.js` starts a fake API on port 8100.
- Phone check: open http://127.0.0.1:5200/tests/phone-frame.html (360 and 768 px).
- Results: `data/model_results.json` is a copy of `../backend/results/model_results.json`. Copy it again after retraining.
- Publish on GitHub Pages: (1) deploy the API first (see [../backend/README.md](../backend/README.md)) and copy its URL; (2) in `js/config.js` set `API_BASE_URL` to that URL, with no slash at the end; (3) push to `main`; (4) on GitHub open Settings > Pages > "Deploy from a branch", choose `main` and `/docs`, and save.
- The site is then at https://arif-almusharafi.github.io/airbnb-price-analysis-and-prediction/, which matches `og:url` and `og:image` in `index.html`. If you use another repo, change those two URLs.
- Files: `index.html`, `css/` (tokens, base, sections, results, predictor), `js/` (config, format, validate, api, results-logic, dom, results-view, predictor, main), `tests/`.
