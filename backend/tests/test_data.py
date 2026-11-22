"""Checks the fixed preprocessing gives the row counts and columns in the Requirements."""
from airbnb_data import FEATURES, load_clean_data, split_data


def test_preprocessing_matches_requirements():
    df = load_clean_data()
    assert len(df) == 38806  # 38,821 after dropna, minus 15 outliers
    X_train, X_test, Y_train, Y_test = split_data(df)
    assert (len(X_train), len(X_test)) == (27164, 11642)
    assert list(X_train.columns) == FEATURES
    assert "id" not in X_train.columns and "price" not in X_train.columns
