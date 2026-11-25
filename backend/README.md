# Backend: Airbnb price predictor API (FastAPI)
Layout: the notebook and CSV sit in the repo root (`../airbnb1.ipynb`, `../AB_NYC_2019.csv`). Run every command from `backend/`.
Install: `python -m venv .venv`, then `.venv\Scripts\python -m pip install -r requirements-dev.txt` (Windows; use `.venv/bin/python` on Mac/Linux).
Run the API: `.venv\Scripts\python -m uvicorn app.main:app --port 8100`, then open http://127.0.0.1:8100/api/health. Test: `.venv\Scripts\python -m pytest -q` (the original-notebook check skips when `../source/` is missing).
Rebuild model + `results/model_results.json`: `.venv\Scripts\python train_model.py`. Re-run the notebook: `.venv\Scripts\python -m jupyter nbconvert --to notebook --execute --inplace ../airbnb1.ipynb`.
Parameter search (slow): `.venv\Scripts\python tune_search.py`. The tuning story is in `TUNING.md`.
Served model: tuned Gradient Boosting (R² 0.620). `model/airbnb_model.joblib` is 0.44 MB (437,352 bytes); the API uses about 170 MB RAM after loading and after 80 predictions (measured on Windows).
Git: commit the model file. It is far below GitHub's 50 MB warning and 100 MB limit, so each retrain adds under 1 MB of history (no Git LFS needed).
Deploy on Render (free, 512 MB RAM): new Web Service, root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, set `PYTHON_VERSION=3.13.7`.
Set env var `ALLOWED_ORIGINS` to your GitHub Pages origin, for example `https://<user>.github.io` (see `.env.example`). The free tier sleeps when idle; the first call takes about a minute.
