"""FastAPI app: GET /api/health and POST /api/predict (see docs/api-contract.md)."""
import logging
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.predictor import load_bundle, predict_price
from app.schemas import BOROUGH_CENTERS, FIELD_MESSAGES, PredictRequest

log = logging.getLogger(__name__)

app = FastAPI(title="Airbnb Price Predictor")
model_bundle = load_bundle()  # None if the model file is missing or broken

origins = ["http://127.0.0.1:5200", "http://localhost:5200"]
origins += [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


class ApiError(Exception):
    def __init__(self, status, code, message, fields=None):
        self.status, self.code, self.message, self.fields = status, code, message, fields or []


def error_response(status, code, message, fields=None, headers=None):
    body = {"error": {"code": code, "message": message, "fields": fields or []}}
    return JSONResponse(status_code=status, content=body, headers=headers)


@app.exception_handler(ApiError)
async def handle_api_error(request: Request, exc: ApiError):
    return error_response(exc.status, exc.code, exc.message, exc.fields)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    if any(e["type"] == "json_invalid" for e in errors):
        return error_response(400, "bad_json", "The request body is not valid JSON.")

    fields = []
    for e in errors:
        loc = [part for part in e["loc"] if part != "body"]
        name = loc[0] if loc else None
        if name in FIELD_MESSAGES and name not in [f["field"] for f in fields]:
            message = "This field is required." if e["type"] == "missing" else FIELD_MESSAGES[name]
            fields.append({"field": name, "message": message})
    if not fields:
        return error_response(422, "validation_error", "The request body must be a JSON object with the predictor fields.")
    return error_response(422, "validation_error", "Some fields are not valid.", fields)


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return error_response(404, "not_found", "This page does not exist.")
    if exc.status_code == 405:
        return error_response(405, "method_not_allowed", "This method is not allowed here.", headers=exc.headers)
    return error_response(exc.status_code, "http_error", "The request could not be handled.", headers=exc.headers)


@app.exception_handler(Exception)
async def handle_any_error(request: Request, exc: Exception):
    log.exception("Unexpected error")
    return error_response(500, "internal_error", "Something went wrong. Please try again.")


@app.get("/api/health")
def health():
    bundle = model_bundle
    return {"status": "ok", "model_loaded": bundle is not None, "model_name": bundle["model_name"] if bundle else None}


@app.post("/api/predict")
def predict(body: PredictRequest):
    values = body.model_dump()
    lat, lon = values["latitude"], values["longitude"]
    if (lat is None) != (lon is None):
        missing = "latitude" if lat is None else "longitude"
        raise ApiError(422, "validation_error", "Some fields are not valid.",
                       [{"field": missing, "message": "Send both latitude and longitude, or leave both empty."}])

    bundle = model_bundle
    if bundle is None:
        raise ApiError(503, "model_unavailable", "The price model is not available right now. Please try again later.")

    location_source = "user"
    if lat is None:
        values["latitude"], values["longitude"] = BOROUGH_CENTERS[values["neighbourhood_group"]]
        location_source = "borough_center"

    price, price_range = predict_price(bundle, values)
    return {
        "predicted_price": price,
        "price_range": price_range,
        "currency": "USD",
        "per": "night",
        "model_name": bundle["model_name"],
        "location_source": location_source,
        "input": values,
    }
