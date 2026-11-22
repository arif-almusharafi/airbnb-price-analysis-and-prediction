"""Request body for POST /api/predict, with the ranges from the API contract."""
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, BeforeValidator, Field


def reject_bool_and_text(value):
    # Pydantic would turn true into 1 and "2" into 2; the contract wants real JSON numbers.
    if isinstance(value, (bool, str)):
        raise ValueError("must be a number")
    return value


Number = BeforeValidator(reject_bool_and_text)

# Rounded median coordinates of each borough after dropna() (fixed by the API contract).
BOROUGH_CENTERS = {
    "Bronx": (40.8472, -73.8901),
    "Brooklyn": (40.6870, -73.9517),
    "Manhattan": (40.7616, -73.9800),
    "Queens": (40.7450, -73.8913),
    "Staten Island": (40.6233, -74.0890),
}

# One plain message per field, shown to visitors next to the form field.
FIELD_MESSAGES = {
    "neighbourhood_group": "Must be one of: Bronx, Brooklyn, Manhattan, Queens, Staten Island.",
    "room_type": "Must be one of: Entire home/apt, Private room, Shared room.",
    "minimum_nights": "Must be a whole number from 1 to 365.",
    "number_of_reviews": "Must be a whole number from 0 to 700.",
    "calculated_host_listings_count": "Must be a whole number from 1 to 350.",
    "availability_365": "Must be a whole number from 0 to 365.",
    "latitude": "Must be a number from 40.49 to 40.92.",
    "longitude": "Must be a number from -74.26 to -73.70.",
}


class PredictRequest(BaseModel):
    # Unknown extra fields are ignored (pydantic's default).
    neighbourhood_group: Literal["Bronx", "Brooklyn", "Manhattan", "Queens", "Staten Island"]
    room_type: Literal["Entire home/apt", "Private room", "Shared room"]
    # Pydantic turns 2.0 into 2, but rejects 2.5.
    minimum_nights: Annotated[int, Number, Field(ge=1, le=365)]
    number_of_reviews: Annotated[int, Number, Field(ge=0, le=700)]
    calculated_host_listings_count: Annotated[int, Number, Field(ge=1, le=350)]
    availability_365: Annotated[int, Number, Field(ge=0, le=365)]
    latitude: Optional[Annotated[float, Number, Field(ge=40.49, le=40.92, allow_inf_nan=False)]] = None
    longitude: Optional[Annotated[float, Number, Field(ge=-74.26, le=-73.70, allow_inf_nan=False)]] = None
