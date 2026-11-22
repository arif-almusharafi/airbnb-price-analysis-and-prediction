"""Arif's notebook preprocessing (with the two bug fixes), as plain functions.

The steps and their order follow airbnb1.ipynb exactly, so the
served model sees the same data as the notebook's Models cell.
"""
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder

BACKEND = Path(__file__).parent
# The studio keeps the notebook and CSV in backend/notebook/; the GitHub repo keeps them at the repo root.
NOTEBOOK_DIR = BACKEND / "notebook" if (BACKEND / "notebook").is_dir() else BACKEND.parent
CSV_PATH = NOTEBOOK_DIR / "AB_NYC_2019.csv"

# Row index labels picked by hand in the notebook (30268 is listed twice there).
OUTLIERS = [42075, 9151, 6530, 12342, 17692, 30268, 2015, 2030, 2031, 11759, 13495, 4377, 30268, 5767, 13404, 26341]

FEATURES = [
    "latitude", "longitude", "minimum_nights", "number_of_reviews",
    "calculated_host_listings_count", "availability_365",
    "neighbourhood_group_Bronx", "neighbourhood_group_Brooklyn", "neighbourhood_group_Manhattan",
    "neighbourhood_group_Queens", "neighbourhood_group_Staten Island",
    "room_type_Entire home/apt", "room_type_Private room", "room_type_Shared room",
]


def load_clean_data(csv_path=CSV_PATH):
    """Steps 1-6: returns the cleaned frame with the log price and one-hot columns."""
    df = pd.read_csv(csv_path)
    df = df.dropna()
    df = df[df.index.isin(list(set(OUTLIERS))) == False]  # fix 1: filter by index, not by id
    df = df.drop(columns=["name", "host_id", "host_name", "neighbourhood", "last_review"])
    df = df.drop(columns=["reviews_per_month"])
    df["price"] = np.log1p(df["price"])

    ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False).set_output(transform="pandas")
    group_cols = ohe.fit_transform(df[["neighbourhood_group"]])
    room_cols = ohe.fit_transform(df[["room_type"]])
    df = pd.concat([df, group_cols, room_cols], axis=1).drop(columns=["neighbourhood_group", "room_type"])
    return df


def split_data(df):
    """Steps 7-8: X without price and id (fix 2), then the notebook's split."""
    X = df.drop(columns=["price", "id"])
    y = df["price"]
    return train_test_split(X, y, test_size=0.3, random_state=42)
