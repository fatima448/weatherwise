"""
WeatherWise ML Backend
======================
FastAPI server that:
  1. Loads the trained Random Forest .pkl files
  2. Exposes POST /predict  →  clothing recommendation + umbrella flag
  3. Optionally fetches live weather from Open-Meteo and runs the model

Run:
    pip install fastapi uvicorn joblib numpy requests
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload

Then in your React app, call:
    POST http://localhost:8000/predict
    Body: { "lat": 41.01, "lon": 28.97 }
"""

import os
import math
import datetime
from pathlib import Path

import numpy as np
import joblib
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "models"   # put your .pkl files here

CLOTHING_MODEL_PATH = MODEL_DIR / "clothing_model.pkl"
UMBRELLA_MODEL_PATH = MODEL_DIR / "umbrella_model.pkl"
ENCODER_PATH        = MODEL_DIR / "label_encoders.pkl"
FEATURE_META_PATH   = MODEL_DIR / "feature_metadata.pkl"

# ── Load models at startup ─────────────────────────────────────────────────
print("Loading models...")
clothing_rf     = joblib.load(CLOTHING_MODEL_PATH)
umbrella_rf     = joblib.load(UMBRELLA_MODEL_PATH)
label_encoders  = joblib.load(ENCODER_PATH)
feature_meta    = joblib.load(FEATURE_META_PATH)
clothing_le     = label_encoders["clothing_recommendation"]
print("✅ Models loaded")

# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="WeatherWise ML API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response models ─────────────────────────────────────────────────
class PredictRequest(BaseModel):
    lat: float = 41.01
    lon: float = 28.97

class PredictResponse(BaseModel):
    clothing_recommendation: str
    clothing_confidence: float
    umbrella_needed: bool
    umbrella_confidence: float
    # Pass-through weather context for the frontend
    temperature_c: float
    feels_like_c: float
    weather_condition: str
    hour_of_day: int
    season: str
    recommendation_text: str       # human-friendly advice string

# ── Helper functions ────────────────────────────────────────────────────────

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_live_weather(lat: float, lon: float) -> dict:
    """Fetch current conditions from Open-Meteo (free, no API key needed)."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": (
            "temperature_2m,apparent_temperature,relative_humidity_2m,"
            "precipitation,wind_speed_10m,wind_gusts_10m,"
            "cloud_cover,weather_code,uv_index"
        ),
        "timezone": "auto",
    }
    r = requests.get(OPEN_METEO_URL, params=params, timeout=10)
    r.raise_for_status()
    return r.json()

def weather_code_to_condition(code: int) -> tuple[str, str]:
    """Map WMO weather code → (condition_label, precipitation_type)."""
    if code == 0:   return "clear",         "none"
    if code <= 2:   return "partly_cloudy", "none"
    if code == 3:   return "cloudy",        "none"
    if code <= 49:  return "fog",           "none"
    if code <= 57:  return "drizzle",       "rain"
    if code <= 67:  return "rain",          "rain"
    if code <= 77:  return "snow",          "snow"
    if code <= 82:  return "rain",          "rain"
    if code <= 99:  return "thunderstorm",  "rain"
    return "clear", "none"

def get_season(month: int) -> str:
    if month in (12, 1, 2): return "winter"
    if month in (3, 4, 5):  return "spring"
    if month in (6, 7, 8):  return "summer"
    return "autumn"

def time_bucket(h: int) -> str:
    if  5 <= h < 10: return "morning"
    if 10 <= h < 14: return "midday"
    if 14 <= h < 18: return "afternoon"
    if 18 <= h < 22: return "evening"
    return "night"

def build_feature_vector(w: dict) -> np.ndarray:
    """
    Build the exact same feature vector used at training time.
    w must contain the keys produced by parse_open_meteo().
    """
    h  = w["hour_of_day"]
    m  = w["month"]

    hour_sin  = math.sin(2 * math.pi * h / 24)
    hour_cos  = math.cos(2 * math.pi * h / 24)
    month_sin = math.sin(2 * math.pi * m / 12)
    month_cos = math.cos(2 * math.pi * m / 12)

    feels_delta    = w["feels_like_c"] - w["temperature_c"]
    temp_humidity  = w["temperature_c"] * w["humidity_pct"] / 100
    wind_chill_idx = w["wind_speed_kmh"] * (1 - w["temperature_c"] / 30)
    is_cold        = int(w["temperature_c"] < 10)
    is_hot         = int(w["temperature_c"] > 25)
    is_precip      = int(w["precipitation_mm"] > 0)
    high_wind      = int(w["wind_speed_kmh"] > 30)

    # Daily estimates from current (used when no daily CSV is available)
    temp     = w["temperature_c"]
    day_min  = temp - 5
    day_max  = temp + 5
    day_precip = w["precipitation_mm"] * 8   # rough daily estimate

    numeric = [
        temp, w["feels_like_c"], feels_delta,
        w.get("dew_point_c", temp - 5),
        w["humidity_pct"], w.get("pressure_hpa", 1013.0),
        w["wind_speed_kmh"], w.get("wind_gust_kmh", w["wind_speed_kmh"] * 1.3),
        w["precipitation_mm"], w["cloud_cover_pct"],
        w.get("visibility_km", 10.0), w["uv_index"],
        hour_sin, hour_cos, month_sin, month_cos,
        w.get("is_weekend", 0), w.get("is_thunderstorm", 0),
        temp_humidity, wind_chill_idx, is_cold, is_hot,
        is_precip, high_wind,
        10.0,           # temp_range_day estimate
        3.0,            # hours_to_best estimate
        day_min, day_max, temp,
        day_precip,
        w["wind_speed_kmh"],
        w["humidity_pct"],
        w["uv_index"],
        is_precip,
        w.get("is_thunderstorm", 0)
    ]

    cat_names = ["season", "time_bucket", "weather_condition",
                 "precipitation_type", "climate_zone"]
    cat_vals  = [
        w["season"],
        time_bucket(h),
        w["weather_condition"],
        w["precipitation_type"],
        w.get("climate_zone", "semi-arid_continental")
    ]

    cat_encoded = []
    for name, val in zip(cat_names, cat_vals):
        le = label_encoders[name]
        try:
            cat_encoded.append(int(le.transform([val])[0]))
        except ValueError:
            cat_encoded.append(0)

    return np.array([numeric + cat_encoded])


def build_recommendation_text(clothing: str, umbrella: bool,
                               temp: float, condition: str) -> str:
    """Generate a short human-friendly advice string."""
    label_map = {
        "heavy_winter_coat_gloves_hat":   "heavy winter coat, gloves & hat",
        "winter_coat_scarf_gloves":        "winter coat, scarf & gloves",
        "warm_jacket_layers":              "warm jacket with layers",
        "light_jacket_or_sweater":         "a light jacket or sweater",
        "long_sleeves_light_layer":        "long sleeves with a light layer",
        "t_shirt_comfortable":             "comfortable t-shirt",
        "light_breathable_clothing":       "light, breathable clothing",
        "very_light_clothing_stay_hydrated": "very light clothing — stay hydrated!",
    }
    advice = label_map.get(clothing, clothing.replace("_", " "))
    umbrella_text = " Don't forget your umbrella!" if umbrella else ""
    return f"Wear {advice} ({temp:.0f}°C, {condition.replace('_',' ')}).{umbrella_text}"


def parse_open_meteo(raw: dict, now: datetime.datetime) -> dict:
    """Extract and rename fields from the Open-Meteo current response."""
    c = raw["current"]
    code = int(c["weather_code"])
    condition, precip_type = weather_code_to_condition(code)
    return {
        "temperature_c":     c["temperature_2m"],
        "feels_like_c":      c["apparent_temperature"],
        "humidity_pct":      c["relative_humidity_2m"],
        "wind_speed_kmh":    c["wind_speed_10m"],
        "wind_gust_kmh":     c.get("wind_gusts_10m", c["wind_speed_10m"] * 1.3),
        "precipitation_mm":  c["precipitation"],
        "cloud_cover_pct":   c["cloud_cover"],
        "uv_index":          c.get("uv_index", 3.0),
        "weather_condition": condition,
        "precipitation_type": precip_type,
        "is_thunderstorm":   int(condition == "thunderstorm"),
        "hour_of_day":       now.hour,
        "month":             now.month,
        "is_weekend":        int(now.weekday() >= 5),
        "season":            get_season(now.month),
    }

# ── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "models": ["clothing_rf", "umbrella_rf"]}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # 1. Fetch live weather
    try:
        raw = fetch_live_weather(req.lat, req.lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {e}")

    now = datetime.datetime.now()
    w   = parse_open_meteo(raw, now)

    # 2. Build feature vector
    X = build_feature_vector(w)

    # 3. Predict
    clothing_idx   = clothing_rf.predict(X)[0]
    clothing_label = clothing_le.inverse_transform([clothing_idx])[0]
    clothing_proba = float(clothing_rf.predict_proba(X)[0].max())

    umbrella_flag  = bool(umbrella_rf.predict(X)[0])
    umbrella_conf  = float(umbrella_rf.predict_proba(X)[0][1])

    # 4. Build friendly text
    rec_text = build_recommendation_text(
        clothing_label, umbrella_flag,
        w["temperature_c"], w["weather_condition"]
    )

    return PredictResponse(
        clothing_recommendation = clothing_label,
        clothing_confidence     = round(clothing_proba, 3),
        umbrella_needed         = umbrella_flag,
        umbrella_confidence     = round(umbrella_conf, 3),
        temperature_c           = w["temperature_c"],
        feels_like_c            = w["feels_like_c"],
        weather_condition       = w["weather_condition"],
        hour_of_day             = w["hour_of_day"],
        season                  = w["season"],
        recommendation_text     = rec_text,
    )
