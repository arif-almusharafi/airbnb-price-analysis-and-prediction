"""Loads the served model (made by train_model.py) and turns form values into a price."""
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODEL_PATH = Path(__file__).parent.parent / "model" / "airbnb_model.joblib"

log = logging.getLogger(__name__)


def load_bundle(path=MODEL_PATH):
    """Returns the saved dict (model, model_name, features, mae_log), or None if it cannot load."""
    try:
        return joblib.load(path)
    except Exception:
        log.exception("Could not load the model file %s", path)
        return None


def build_row(bundle, values):
    """The 14 model columns, in the saved order, from the 8 request values."""
    row = {name: 0.0 for name in bundle["features"]}
    for name in ("latitude", "longitude", "minimum_nights", "number_of_reviews",
                 "calculated_host_listings_count", "availability_365"):
        row[name] = values[name]
    row["neighbourhood_group_" + values["neighbourhood_group"]] = 1.0
    row["room_type_" + values["room_type"]] = 1.0
    return pd.DataFrame([row], columns=bundle["features"])


def to_dollars(log_price):
    return max(0, int(round(float(np.expm1(log_price)))))


def predict_price(bundle, values):
    """Returns (price, price_range). The model predicts log1p(price)."""
    p = float(bundle["model"].predict(build_row(bundle, values))[0])
    mae_log = bundle.get("mae_log")
    price_range = None
    if mae_log is not None:
        price_range = {"low": to_dollars(p - mae_log), "high": to_dollars(p + mae_log)}
    return to_dollars(p), price_range
