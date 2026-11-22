# Tuning record

All metrics are on the test set (30%, `random_state=42`) and on the `log1p(price)` scale.

- **Original**: the README table (original notebook: outlier filter removed 0 rows, `id` was a feature).
- **Bug fixes**: Arif's original parameters on the fixed data (15 outlier rows removed, `id` dropped). Made by `train_model.py`.
- **Tuned**: the fixed data with the new parameters. Taken from the executed `notebook/airbnb1.ipynb`; `train_model.py` gets the same numbers.

| Model | Old parameters | New parameters | Original MAE / RMSE / R² | Bug fixes MAE / RMSE / R² | Tuned MAE / RMSE / R² |
|---|---|---|---|---|---|
| Linear Regression | defaults | defaults (nothing to tune) | 0.338 / 0.455 / 0.527 | 0.342 / 0.464 / 0.516 | 0.342 / 0.464 / 0.516 |
| Random Forest | defaults (100 trees) | `n_estimators=300, min_samples_leaf=2, max_features=0.33, random_state=42` | 0.293 / 0.405 / 0.625 | 0.301 / 0.414 / 0.614 | **0.294 / 0.407 / 0.628** |
| KNN | `n_neighbors=15`, no scaling | `StandardScaler` + `n_neighbors=40, weights="distance"` | 0.530 / 0.672 / -0.033 | 0.451 / 0.592 / 0.212 | 0.307 / 0.421 / 0.602 |
| Gradient Boosting | defaults | `n_estimators=300, learning_rate=0.05, max_depth=5, random_state=42` | 0.304 / 0.415 / 0.606 | 0.307 / 0.422 / 0.600 | 0.298 / 0.412 / 0.620 |
| SVR | defaults, no scaling | `StandardScaler` + `C=10, epsilon=0.2` | 0.522 / 0.658 / 0.010 | 0.424 / 0.565 / 0.284 | 0.305 / 0.425 / 0.595 |

## What the numbers say

- After the bug fixes, Linear Regression, Random Forest, and Gradient Boosting got slightly **worse** (R² 0.527 to 0.516, 0.625 to 0.614, 0.606 to 0.600). The listing `id` gave the models a little signal (probably because ids grow with listing age), but it is not something a visitor can enter, so a predictor should not use it.
- KNN and SVR improved after the fixes, and much more after scaling: they measure distances, so unscaled columns like `availability_365` (0 to 365) drowned out the 0/1 columns.
- Tuning beats the original best: Random Forest R² 0.628 against 0.625, on cleaner data and without `id`.
- Random Forest and Gradient Boosting in the "Bug fixes" stage have no `random_state` (as in Arif's cell), so re-running `train_model.py` can move those numbers by about 0.001 to 0.003.

## How the values were chosen

`tune_search.py`: `GridSearchCV` with 3-fold cross-validation, scored by R², on the **training set only**. The test set was never used to choose values.
Two rounds: when a best value sat on the edge of the first grid, the grid was widened once around it. Final best CV R²: Random Forest 0.617, Gradient Boosting 0.612, KNN 0.595, SVR 0.594.
`C=10` for SVR is still the largest value tried; larger `C` is much slower to fit for a very small gain (CV R² 0.592 at `C=3`).

## Served model

The live API serves the tuned **Gradient Boosting** model (R² 0.620), not the best-scoring Random Forest (R² 0.628). Arif decided this after QA-2:
the Random Forest file was 93.3 MB and the API used about 480 MB of RAM with it loaded, too close to Render free's 512 MB.

| Served model | File (`model/airbnb_model.joblib`) | API RAM (working set, Windows) | Test MAE |
|---|---|---|---|
| Random Forest (before) | 93.3 MB | about 480 MB | 0.294 log, about $47 |
| **Gradient Boosting (now)** | 0.44 MB (437,352 bytes) | 168.5 MB after loading, 173 MB after 81 predictions | 0.298 log, about $48 |

In `results/model_results.json`, `served_model.fallback_used` is `true` (the served model is not the best tuned one), and `served_model.reason` is the sentence the page shows.
