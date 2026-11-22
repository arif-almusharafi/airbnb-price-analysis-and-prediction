"""API tests. Most use a fake model that always predicts $100, so they run fast."""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sklearn.dummy import DummyRegressor

from airbnb_data import FEATURES
from app import main
from app.main import app
from app.predictor import MODEL_PATH, build_row, load_bundle

GOOD_BODY = {
    "neighbourhood_group": "Manhattan",
    "room_type": "Entire home/apt",
    "minimum_nights": 2,
    "number_of_reviews": 9,
    "calculated_host_listings_count": 1,
    "availability_365": 55,
}
client = TestClient(app)


def fake_bundle(mae_log=0.5):
    X = pd.DataFrame(np.zeros((1, len(FEATURES))), columns=FEATURES)
    model = DummyRegressor(strategy="constant", constant=np.log1p(100)).fit(X, [0])
    return {"model": model, "model_name": "FakeModel", "features": FEATURES, "mae_log": mae_log}


@pytest.fixture(autouse=True)
def use_fake_model(monkeypatch):
    monkeypatch.setattr(main, "model_bundle", fake_bundle())


def field_errors(response):
    return {f["field"]: f["message"] for f in response.json()["error"]["fields"]}


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "model_loaded": True, "model_name": "FakeModel"}


def test_health_without_model(monkeypatch):
    monkeypatch.setattr(main, "model_bundle", None)
    assert client.get("/api/health").json() == {"status": "ok", "model_loaded": False, "model_name": None}


def test_predict_uses_borough_center():
    r = client.post("/api/predict", json=GOOD_BODY)
    assert r.status_code == 200
    data = r.json()
    assert data["predicted_price"] == 100
    assert data["price_range"] == {"low": round(np.expm1(np.log1p(100) - 0.5)), "high": round(np.expm1(np.log1p(100) + 0.5))}
    assert data["currency"] == "USD" and data["per"] == "night"
    assert data["model_name"] == "FakeModel"
    assert data["location_source"] == "borough_center"
    assert data["input"] == {**GOOD_BODY, "latitude": 40.7616, "longitude": -73.98}
    both_null = client.post("/api/predict", json={**GOOD_BODY, "latitude": None, "longitude": None}).json()
    assert both_null["location_source"] == "borough_center"


def test_predict_with_user_location_and_extra_field():
    body = {**GOOD_BODY, "latitude": 40.7, "longitude": -74.0, "id": 123}
    data = client.post("/api/predict", json=body).json()
    assert data["location_source"] == "user"
    assert data["input"]["latitude"] == 40.7 and "id" not in data["input"]


def test_range_is_null_when_mae_unknown(monkeypatch):
    monkeypatch.setattr(main, "model_bundle", fake_bundle(mae_log=None))
    assert client.post("/api/predict", json=GOOD_BODY).json()["price_range"] is None


def test_whole_float_is_accepted_but_fraction_is_not():
    assert client.post("/api/predict", json={**GOOD_BODY, "minimum_nights": 2.0}).json()["input"]["minimum_nights"] == 2
    r = client.post("/api/predict", json={**GOOD_BODY, "minimum_nights": 2.5})
    assert r.status_code == 422
    assert field_errors(r) == {"minimum_nights": "Must be a whole number from 1 to 365."}


@pytest.mark.parametrize("field, value", [
    ("room_type", "private room"),  # case-sensitive
    ("neighbourhood_group", "Harlem"),
    ("number_of_reviews", 701),
    ("availability_365", -1),
    ("latitude", 41.5),
    ("minimum_nights", True),  # wrong types are not converted
    ("number_of_reviews", "9"),
    ("latitude", "40.7"),
])
def test_bad_values_return_422(field, value):
    body = {**GOOD_BODY, "latitude": 40.7, "longitude": -74.0, field: value}
    r = client.post("/api/predict", json=body)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"
    assert field in field_errors(r)


def test_missing_field():
    body = dict(GOOD_BODY)
    del body["room_type"]
    r = client.post("/api/predict", json=body)
    assert r.status_code == 422
    assert field_errors(r) == {"room_type": "This field is required."}


def test_only_one_coordinate():
    r = client.post("/api/predict", json={**GOOD_BODY, "latitude": 40.7})
    assert r.status_code == 422
    assert list(field_errors(r)) == ["longitude"]


def test_body_not_an_object():
    r = client.post("/api/predict", json=[1, 2])
    assert r.status_code == 422
    assert r.json()["error"]["fields"] == []


def test_bad_json():
    r = client.post("/api/predict", content="{not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json()["error"] == {"code": "bad_json", "message": "The request body is not valid JSON.", "fields": []}


def test_not_found_and_wrong_method():
    assert client.get("/api/nothing").json()["error"]["code"] == "not_found"
    r = client.get("/api/predict")
    assert r.status_code == 405
    assert r.json()["error"]["code"] == "method_not_allowed"


def test_model_missing_returns_503(monkeypatch):
    monkeypatch.setattr(main, "model_bundle", None)
    r = client.post("/api/predict", json=GOOD_BODY)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "model_unavailable"


def test_cors_allows_local_frontend():
    r = client.get("/api/health", headers={"Origin": "http://localhost:5200"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5200"


def test_build_row_sets_one_hot_columns():
    values = {**GOOD_BODY, "neighbourhood_group": "Staten Island", "room_type": "Shared room",
              "latitude": 40.6, "longitude": -74.1}
    row = build_row(fake_bundle(), values)
    assert list(row.columns) == FEATURES
    assert row.loc[0, "neighbourhood_group_Staten Island"] == 1 and row.loc[0, "room_type_Shared room"] == 1
    assert row.loc[0, "neighbourhood_group_Manhattan"] == 0 and row.loc[0, "room_type_Entire home/apt"] == 0
    assert row.loc[0, "minimum_nights"] == 2


@pytest.mark.skipif(not MODEL_PATH.exists(), reason="run train_model.py first")
def test_real_model_gives_a_sensible_price(monkeypatch):
    monkeypatch.setattr(main, "model_bundle", load_bundle())
    data = client.post("/api/predict", json=GOOD_BODY).json()
    assert 20 < data["predicted_price"] < 1000
    assert data["price_range"]["low"] <= data["predicted_price"] <= data["price_range"]["high"]
