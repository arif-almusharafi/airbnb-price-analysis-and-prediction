"""Checks the notebook copy has only the 3 allowed changes, and that
results/model_results.json agrees with the README and the executed notebook."""
import json

import pytest

from airbnb_data import BACKEND, NOTEBOOK_DIR

SOURCE_NOTEBOOK = BACKEND.parent / "source" / "airbnb1.ipynb"  # only in the studio, not in the GitHub repo
NOTEBOOK = NOTEBOOK_DIR / "airbnb1.ipynb"
RESULTS = json.loads((BACKEND / "results" / "model_results.json").read_text(encoding="utf-8"))


def cell_sources(path):
    cells = json.loads(path.read_text(encoding="utf-8"))["cells"]
    return ["".join(c["source"]) for c in cells]


@pytest.mark.skipif(not SOURCE_NOTEBOOK.exists(),
                    reason="source/airbnb1.ipynb (Arif's original notebook) exists only in the studio layout")
def test_only_three_cells_changed():
    old, new = cell_sources(SOURCE_NOTEBOOK), cell_sources(NOTEBOOK)
    assert len(old) == len(new)
    changed = [(a, b) for a, b in zip(old, new) if a != b]
    assert len(changed) == 3
    assert changed[0][1] == "df = df[df.index.isin(outliers) == False]"
    assert changed[1][1].startswith("X = df.drop(columns = ['price', 'id'])")
    assert changed[2][1].startswith("# Define Models")
    assert "MSE = np.sqrt(mean_squared_error(Y_test, Y_pred))" in changed[2][1]


def test_tuned_numbers_equal_the_executed_notebook():
    cells = json.loads(NOTEBOOK.read_text(encoding="utf-8"))["cells"]
    table_cell = next(c for c in cells if "".join(c["source"]).startswith("results_df = pd.DataFrame"))
    lines = "".join(table_cell["outputs"][0]["data"]["text/plain"]).splitlines()[1:]
    notebook = {parts[1]: [float(x) for x in parts[2:]] for parts in (line.split() for line in lines)}
    for model in RESULTS["models"]:
        tuned = model["tuned"]
        assert notebook[model["name"]] == [tuned["mae"], tuned["rmse"], tuned["r2"]], model["name"]


def test_results_shape():
    names = [m["name"] for m in RESULTS["models"]]
    assert names == ["LinearRegression", "RandomForestRegressor", "KNeighborsRegressor", "GradientBoostingRegressor", "SVR"]
    assert RESULTS["models"][1]["original"] == {"params": {}, "mae": 0.293, "rmse": 0.405, "r2": 0.625}
    assert RESULTS["split"]["train_rows"] == 27164 and RESULTS["split"]["test_rows"] == 11642
    served = RESULTS["served_model"]
    best = max(RESULTS["models"], key=lambda m: m["tuned"]["r2"])["name"]
    assert served["name"] == "GradientBoostingRegressor"  # Arif's decision after QA-2
    assert served["fallback_used"] == (served["name"] != best)
    assert isinstance(served["reason"], str) and served["reason"]
