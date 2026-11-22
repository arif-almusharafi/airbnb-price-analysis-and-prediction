"""Trains the served model and writes results/model_results.json.

For each of the 5 notebook models it measures two stages on the fixed data:
  fixed: Arif's original parameters (his first Models cell, no scaling)
  tuned: the parameters in the notebook copy's Models cell
Then it saves the tuned Gradient Boosting model to model/airbnb_model.joblib.

    python train_model.py      (takes a few minutes, SVR is slow)
"""
import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

from airbnb_data import FEATURES, load_clean_data, split_data

BACKEND = Path(__file__).parent
MODEL_PATH = BACKEND / "model" / "airbnb_model.joblib"
RESULTS_PATH = BACKEND / "results" / "model_results.json"
MAX_FILE_BYTES = 100 * 1024 * 1024  # GitHub's file size limit
# Arif's decision (QA-2): serve Gradient Boosting, not the best-R2 Random Forest,
# because the Random Forest needs about 480 MB RAM and Render free has 512 MB.
SERVED_MODEL = "GradientBoostingRegressor"

# Same order as the notebook's Models dict.
MODELS = {
    "LinearRegression": (LinearRegression, "Linear Regression"),
    "RandomForestRegressor": (RandomForestRegressor, "Random Forest"),
    "KNeighborsRegressor": (KNeighborsRegressor, "K-Nearest Neighbors"),
    "GradientBoostingRegressor": (GradientBoostingRegressor, "Gradient Boosting"),
    "SVR": (SVR, "SVR"),
}

# The README table of the original notebook: (MAE, RMSE, R2).
ORIGINAL_RESULTS = {
    "LinearRegression": (0.338, 0.455, 0.527),
    "RandomForestRegressor": (0.293, 0.405, 0.625),
    "KNeighborsRegressor": (0.530, 0.672, -0.033),
    "GradientBoostingRegressor": (0.304, 0.415, 0.606),
    "SVR": (0.522, 0.658, 0.010),
}
ORIGINAL_PARAMS = {"KNeighborsRegressor": {"n_neighbors": 15}}

# Must stay the same as the Models cell in notebook/airbnb1.ipynb.
TUNED_PARAMS = {
    "LinearRegression": {},
    "RandomForestRegressor": {"n_estimators": 300, "min_samples_leaf": 2, "max_features": 0.33, "random_state": 42},
    "KNeighborsRegressor": {"n_neighbors": 40, "weights": "distance"},
    "GradientBoostingRegressor": {"n_estimators": 300, "learning_rate": 0.05, "max_depth": 5, "random_state": 42},
    "SVR": {"C": 10, "epsilon": 0.2},
}
SCALED = {"KNeighborsRegressor", "SVR"}  # wrapped in make_pipeline(StandardScaler(), ...)

FIXES = [
    "Outlier filter now uses the row index: 15 extreme rows removed (38,821 to 38,806 rows).",
    "Listing id removed from the model features.",
    "RMSE computed with np.sqrt(mean_squared_error(...)) for newer scikit-learn.",
]


def build(name, params, scaled):
    model = MODELS[name][0](**params)
    return make_pipeline(StandardScaler(), model) if scaled else model


def evaluate(model, X_train, Y_train, X_test, Y_test):
    """Fits the model and returns (rounded metrics, test predictions), like the notebook loop."""
    model.fit(X_train, Y_train)
    Y_pred = model.predict(X_test)
    metrics = {
        "mae": round(mean_absolute_error(Y_test, Y_pred), 3),
        "rmse": round(float(np.sqrt(mean_squared_error(Y_test, Y_pred))), 3),
        "r2": round(r2_score(Y_test, Y_pred), 3),
    }
    return metrics, Y_pred


def save_model(name, model, mae_log):
    """Saves the served bundle and returns its size in bytes."""
    MODEL_PATH.parent.mkdir(exist_ok=True)
    bundle = {"model": model, "model_name": name, "features": FEATURES, "mae_log": mae_log}
    joblib.dump(bundle, MODEL_PATH, compress=3)
    return MODEL_PATH.stat().st_size


def served_reason(results):
    """One sentence for the page: why the live predictor is not the best model."""
    r2 = {m["name"]: m["tuned"]["r2"] for m in results}
    return (f"The live predictor uses Gradient Boosting (R² {r2['GradientBoostingRegressor']:.3f}). "
            f"Random Forest scores slightly higher (R² {r2['RandomForestRegressor']:.3f}), but it needs about "
            "480 MB of memory, and the much smaller Gradient Boosting model fits free hosting (512 MB).")


def main():
    df = load_clean_data()
    X_train, X_test, Y_train, Y_test = split_data(df)
    assert list(X_train.columns) == FEATURES, "feature order changed"
    print(f"rows: {len(df)}, train: {len(X_train)}, test: {len(X_test)}")

    results, tuned_fits = [], {}
    for name, (_, label) in MODELS.items():
        fixed, _ = evaluate(build(name, ORIGINAL_PARAMS.get(name, {}), False), X_train, Y_train, X_test, Y_test)
        tuned_model = build(name, TUNED_PARAMS[name], name in SCALED)
        tuned, Y_pred = evaluate(tuned_model, X_train, Y_train, X_test, Y_test)
        tuned_fits[name] = (tuned_model, Y_pred)
        print(f"{name}: fixed {fixed} | tuned {tuned}", flush=True)

        mae, rmse, r2 = ORIGINAL_RESULTS[name]
        tuned_params = dict(TUNED_PARAMS[name], scaled=True) if name in SCALED else TUNED_PARAMS[name]
        results.append({
            "name": name,
            "label": label,
            "original": {"params": ORIGINAL_PARAMS.get(name, {}), "mae": mae, "rmse": rmse, "r2": r2},
            "fixed": {"params": ORIGINAL_PARAMS.get(name, {}), **fixed},
            "tuned": {"params": tuned_params, **tuned},
        })

    best = max(results, key=lambda m: m["tuned"]["r2"])["name"]
    served = SERVED_MODEL
    model, Y_pred = tuned_fits[served]
    mae_log = mean_absolute_error(Y_test, Y_pred)
    size = save_model(served, model, mae_log)
    assert size < MAX_FILE_BYTES, f"model file is {size / 1e6:.1f} MB, over GitHub's limit"
    mae_dollars = float(np.mean(np.abs(np.expm1(Y_test) - np.expm1(Y_pred))))
    print(f"served: {served}, file {size / 1e6:.1f} MB, MAE log {mae_log:.3f}, MAE ${mae_dollars:.0f}")

    output = {
        "target": "log1p(price)",
        "split": {"test_size": 0.3, "random_state": 42, "train_rows": len(X_train), "test_rows": len(X_test)},
        "fixes": FIXES,
        "models": results,
        "served_model": {"name": served, "mae_log": round(mae_log, 3), "mae_dollars": round(mae_dollars),
                         "fallback_used": served != best, "reason": served_reason(results)},
    }
    RESULTS_PATH.parent.mkdir(exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {RESULTS_PATH}")


if __name__ == "__main__":
    main()
