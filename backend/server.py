"""
WeatherWise ML Backend — v3.0
==============================
FastAPI server that:
  1. Loads clothing + umbrella models 
  2. Loads the NEW activity scoring model (GradientBoostingRegressor)
  3. POST /predict      → clothing + umbrella 
  4. POST /predict/all  → clothing + umbrella + top-3 activity suggestions

Run:
    pip install fastapi uvicorn joblib numpy requests scikit-learn
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import math
import datetime
from pathlib import Path
from typing import Optional, Any
from dotenv import load_dotenv
load_dotenv()

import numpy as np
import joblib
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "models"

# Clothing + umbrella 
CLOTHING_MODEL_PATH = MODEL_DIR / "clothing_model.pkl"
UMBRELLA_MODEL_PATH = MODEL_DIR / "umbrella_model.pkl"
ENCODER_PATH        = MODEL_DIR / "label_encoders.pkl"
FEATURE_META_PATH   = MODEL_DIR / "feature_metadata.pkl"

# Activity model (NEW — replaces old activity_model.pkl + activity_encoders.pkl)
ACTIVITY_MODEL_PATH   = MODEL_DIR / "activity_model.pkl"
ACTIVITY_ENCODER_PATH = MODEL_DIR / "activity_label_encoders.pkl"   # ← NEW filename
ACTIVITY_META_PATH    = MODEL_DIR / "activity_metadata.pkl"


# ── Load Safety ML models (6 models) ───────────────────────────────────────
print("Loading safety models...")

UV_MODEL_PATH          = MODEL_DIR / "model_A.pkl"
HYDRATION_MODEL_PATH   = MODEL_DIR / "model_B.pkl"
ROAD_MODEL_PATH        = MODEL_DIR / "model_C.pkl"
WIND_ALERT_MODEL_PATH  = MODEL_DIR / "model_D.pkl"
WIND_CHILL_MODEL_PATH  = MODEL_DIR / "model_E.pkl"
OUTDOOR_MODEL_PATH     = MODEL_DIR / "model_F.pkl"

uv_model          = joblib.load(UV_MODEL_PATH)
hydration_model   = joblib.load(HYDRATION_MODEL_PATH)
road_model        = joblib.load(ROAD_MODEL_PATH)
wind_alert_model  = joblib.load(WIND_ALERT_MODEL_PATH)
wind_chill_model  = joblib.load(WIND_CHILL_MODEL_PATH)
outdoor_model     = joblib.load(OUTDOOR_MODEL_PATH)

SAFETY_FEATURE_LIST_PATH = MODEL_DIR / "safety_feature_list.pkl"

try:
    safety_feature_list = joblib.load(SAFETY_FEATURE_LIST_PATH)
    print(f"✅ Safety feature list loaded: {len(safety_feature_list)} features")
    print(f"   Features: {safety_feature_list}")
except FileNotFoundError:
    # Graceful fallback — will still fail if counts don't match,
    # but at least the error message will be informative
    safety_feature_list = None
    print("⚠️  safety_feature_list.pkl not found — "
          "build_safety_features will raise a clear error at inference time")
    
# ── Load models at startup ──────────────────────────────────────────────────
print("Loading clothing + umbrella models...")
clothing_rf    = joblib.load(CLOTHING_MODEL_PATH)
umbrella_rf    = joblib.load(UMBRELLA_MODEL_PATH)
label_encoders = joblib.load(ENCODER_PATH)
feature_meta   = joblib.load(FEATURE_META_PATH)
clothing_le    = label_encoders["clothing_recommendation"]

print("Loading activity model...")
activity_model    = joblib.load(ACTIVITY_MODEL_PATH)
activity_encoders = joblib.load(ACTIVITY_ENCODER_PATH)   # dict: season/weather_condition/activity_type
activity_meta     = joblib.load(ACTIVITY_META_PATH)

# Shortcuts
le_activity = activity_encoders["activity_type"]
le_season   = activity_encoders["season"]
le_weather  = activity_encoders["weather_condition"]

ACTIVITY_FEATURES = activity_meta["features"]

print("✅ All models loaded")
print(f"   Activity classes: {le_activity.classes_.tolist()}")
print(f"   Approach: {activity_meta.get('approach')}")
print(f"   Model R²: {activity_meta.get('r2', 'n/a'):.3f}")

# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="WeatherWise ML API", version="3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request/Response models ─────────────────────────────────────────────────
class PredictRequest(BaseModel):
    lat: float = 41.01
    lon: float = 28.97


class ActivitySuggestion(BaseModel):
    activity:   str    # e.g. "running"
    confidence: float  # 0–1 normalized score
    label:      str    # human readable
    emoji:      str    # UI emoji


# ── Safety insight sub-models ───────────────────────────────────────────────
class UVProtection(BaseModel):
    label: str   # "none" | "sunglasses" | "sunscreen"

class HydrationAlert(BaseModel):
    triggered: bool

class RoadSurface(BaseModel):
    label: str   # "dry" | "wet" | "icy"

class WindAlert(BaseModel):
    triggered: bool

class WindChillWarning(BaseModel):
    triggered: bool

class OutdoorPoor(BaseModel):
    triggered: bool

class MLInsights(BaseModel):
    uvProtection:     UVProtection
    hydrationAlert:   HydrationAlert
    roadSurface:      RoadSurface
    windAlert:        WindAlert
    windChillWarning: WindChillWarning
    outdoorPoor:      OutdoorPoor


class PredictAllResponse(BaseModel):
    clothing_recommendation: str
    clothing_confidence:     float
    umbrella_needed:         bool
    umbrella_confidence:     float
    activity_suggestions:    list[ActivitySuggestion]
    temperature_c:           float
    feels_like_c:            float
    weather_condition:       str
    hour_of_day:             int
    season:                  str
    recommendation_text:     str
    mlInsights:              MLInsights          # ← NOW PROPERLY DECLARED


# ── Helper: Weather fetch ───────────────────────────────────────────────────
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_live_weather(lat: float, lon: float) -> dict:
    params = {
        "latitude":  lat,
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


def parse_open_meteo(raw: dict, now: datetime.datetime) -> dict:
    c = raw["current"]
    code = int(c["weather_code"])
    condition, precip_type = weather_code_to_condition(code)
    return {
        "temperature_c":      c["temperature_2m"],
        "feels_like_c":       c["apparent_temperature"],
        "humidity_pct":       c["relative_humidity_2m"],
        "wind_speed_kmh":     c["wind_speed_10m"],
        "wind_gust_kmh":      c.get("wind_gusts_10m", c["wind_speed_10m"] * 1.3),
        "precipitation_mm":   c["precipitation"],
        "cloud_cover_pct":    c["cloud_cover"],
        "uv_index":           c.get("uv_index", 3.0),
        "weather_condition":  condition,
        "precipitation_type": precip_type,
        "is_thunderstorm":    int(condition == "thunderstorm"),
        "hour_of_day":        now.hour,
        "month":              now.month,
        "day_of_week":        now.weekday(),
        "is_weekend":         int(now.weekday() >= 5),
        "season":             get_season(now.month),
    }

# ── ADD THIS BLOCK to server.py just before the app.mount() at the bottom ──
# 1. pip install httpx python-dotenv
# 2. Add OPENROUTER_API_KEY=sk-or-v1-... to your .env file

import httpx
import json as _json

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"  # free model, change to "anthropic/claude-3.5-haiku" if you have credits


async def call_openrouter(messages: list[dict], max_tokens: int = 300) -> str:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://weatherwise.app",   # can be anything
                "X-Title": "WeatherWise",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            },
        )
        if not resp.is_success:
            err = resp.json()
            raise HTTPException(status_code=502, detail=str(err))
        data = resp.json()

    return data["choices"][0]["message"]["content"]


# ── Chat request/response models ────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    text: str

class ChatRequestBody(BaseModel):
    history: list[ChatMessage]
    tasks: list[dict] = []
    weather: Optional[dict] = None

class ChatResponse(BaseModel):
    reply: str


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequestBody):
    """
    Multi-turn WeatherWise chat via OpenRouter (works from Yandex Cloud).
    """
    current = req.weather.get("current", {}) if req.weather else {}
    conflicts = [
        f"{t.get('label','?')} at {t.get('time','?')} ({t.get('conflictReason','')})"
        for t in req.tasks if t.get("conflict")
    ]

    system_prompt = f"""You are WeatherWise Assistant — a concise, friendly weather & task advisor inside a weather app.

User's tasks today:
{chr(10).join(f"- {t.get('label','?')} at {t.get('time','?')}" + (" ⚠️ CONFLICT: " + t.get('conflictReason','') if t.get('conflict') else " ✅") for t in req.tasks) if req.tasks else "No tasks added yet."}

Current weather:
- {current.get('temperature_2m','?')}°C, feels like {current.get('apparent_temperature','?')}°C
- Humidity: {current.get('relative_humidity_2m','?')}%, Wind: {current.get('wind_speed_10m','?')} km/h
- UV: {current.get('uv_index','?')}, Weather code: {current.get('weathercode','?')}
{("Conflicting tasks: " + "; ".join(conflicts)) if conflicts else ""}

Rules:
- Be warm and conversational, NOT robotic
- Keep replies to 2-3 sentences max
- If asked about a task, check its conflict status above
- Give specific time-based advice when possible
- Never start with "Certainly!" or "Great question!" """

    # Build messages array for OpenRouter (OpenAI format)
    messages = [{"role": "system", "content": system_prompt}]
    for msg in req.history:
        role = "user" if msg.role == "user" else "assistant"
        messages.append({"role": role, "content": msg.text})

    reply = await call_openrouter(messages, max_tokens=200)
    return ChatResponse(reply=reply)


# ── Conditions summary ───────────────────────────────────────────────────────
class ConditionsRequest(BaseModel):
    weather: dict
    mlPrediction: Optional[dict] = None

class ConditionsResponse(BaseModel):
    summary: str
    tips: list[str]


@app.post("/conditions", response_model=ConditionsResponse)
async def conditions_endpoint(req: ConditionsRequest):
    """
    Replaces the hanging 'Checking conditions...' Anthropic call.
    Returns a short weather summary + tips via OpenRouter.
    """
    current = req.weather.get("current", {}) if req.weather else {}
    ml = req.mlPrediction or {}

    messages = [
        {
            "role": "system",
            "content": "You are a weather assistant. Always respond with valid JSON only — no markdown, no explanation.",
        },
        {
            "role": "user",
            "content": f"""Weather right now:
- Temperature: {current.get('temperature_2m','?')}°C, feels like {current.get('apparent_temperature','?')}°C
- Humidity: {current.get('relative_humidity_2m','?')}%, Wind: {current.get('wind_speed_10m','?')} km/h
- UV Index: {current.get('uv_index','?')}
- Precipitation: {current.get('precipitation', 0)} mm
- Clothing recommendation: {ml.get('clothing_recommendation','').replace('_',' ')}
- Umbrella needed: {ml.get('umbrella_needed', False)}

Respond ONLY with this JSON:
{{
  "summary": "One friendly sentence describing conditions right now",
  "tips": ["tip 1", "tip 2", "tip 3"]
}}""",
        },
    ]

    text = await call_openrouter(messages, max_tokens=200)

    try:
        clean = text.replace("```json", "").replace("```", "").strip()
        parsed = _json.loads(clean)
        return ConditionsResponse(
            summary=parsed.get("summary", "Conditions look fine."),
            tips=parsed.get("tips", []),
        )
    except Exception:
        return ConditionsResponse(summary=text[:200], tips=[])
    
# ── Helper: Clothing/Umbrella feature vector  ───────────────────
def build_clothing_features(w: dict) -> np.ndarray:
    h = w["hour_of_day"]
    m = w["month"]

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

    temp      = w["temperature_c"]
    day_min   = temp - 5
    day_max   = temp + 5
    day_precip = w["precipitation_mm"] * 8

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
        10.0, 3.0,
        day_min, day_max, temp, day_precip,
        w["wind_speed_kmh"], w["humidity_pct"], w["uv_index"],
        is_precip, w.get("is_thunderstorm", 0),
    ]

    cat_names = ["season", "time_bucket", "weather_condition",
                 "precipitation_type", "climate_zone"]
    cat_vals  = [
        w["season"], time_bucket(h), w["weather_condition"],
        w["precipitation_type"], w.get("climate_zone", "semi-arid_continental"),
    ]
    cat_encoded = []
    for name, val in zip(cat_names, cat_vals):
        le = label_encoders[name]
        try:    cat_encoded.append(int(le.transform([val])[0]))
        except: cat_encoded.append(0)

    return np.array([numeric + cat_encoded])


# ── Helper: Build activity feature vector ──────────────────────────────────
OUTDOOR_PHYSICAL = {"cycling", "running", "sports"}
OUTDOOR_LEISURE  = {"picnic", "walking", "outdoor_work"}
INDOOR_TRANSPORT = {"commute", "driving"}


def build_activity_features(w: dict, activity_name: str) -> np.ndarray:
    h    = w["hour_of_day"]
    m    = w["month"]
    dow  = w.get("day_of_week", 0)

    feels_delta   = w["feels_like_c"] - w["temperature_c"]
    temp_humidity = w["temperature_c"] * w["humidity_pct"] / 100
    comfort_score = (
        - abs(w["temperature_c"] - 20) * 0.5
        - w["humidity_pct"] * 0.05
        - w["wind_speed_kmh"] * 0.1
        - w["precipitation_mm"] * 2
        + w["uv_index"] * 0.3
    )

    is_op    = int(activity_name in OUTDOOR_PHYSICAL)
    is_ol    = int(activity_name in OUTDOOR_LEISURE)
    is_tr    = int(activity_name in INDOOR_TRANSPORT)
    precip   = w["precipitation_mm"]
    wind     = w["wind_speed_kmh"]
    is_cold  = int(w["temperature_c"] < 5)
    is_precip = int(precip > 0)

    try:
        act_enc     = int(le_activity.transform([activity_name])[0])
    except ValueError:
        act_enc = 0

    season_str = w["season"]
    if season_str not in le_season.classes_:
        season_str = "spring"
    season_enc = int(le_season.transform([season_str])[0])

    weather_str = w["weather_condition"]
    WEATHER_MAP = {
        "fog": "cloudy",
        "autumn": "cloudy",
    }
    weather_str = WEATHER_MAP.get(weather_str, weather_str)
    if weather_str not in le_weather.classes_:
        weather_str = "cloudy"
    weather_enc = int(le_weather.transform([weather_str])[0])

    features = [
        w["temperature_c"], w["feels_like_c"], feels_delta,
        w["humidity_pct"], wind, precip,
        w["cloud_cover_pct"], w["uv_index"],
        math.sin(2 * math.pi * h / 24), math.cos(2 * math.pi * h / 24),
        math.sin(2 * math.pi * m / 12), math.cos(2 * math.pi * m / 12),
        math.sin(2 * math.pi * dow / 7), math.cos(2 * math.pi * dow / 7),
        w.get("is_weekend", 0),
        is_cold,
        int(5 <= w["temperature_c"] < 15),
        int(15 <= w["temperature_c"] < 28),
        int(w["temperature_c"] >= 28),
        is_precip, int(precip > 5),
        int(wind > 30), int(w["uv_index"] > 6),
        temp_humidity, comfort_score,
        is_op, is_ol, is_tr,
        is_op * precip, is_op * wind, is_op * is_cold,
        is_ol * precip, is_tr * is_precip,
        act_enc, season_enc, weather_enc,
    ]

    return np.array([features])


def predict_top_activities(w: dict, n: int = 3) -> list[dict]:
    results = []
    for act_name in le_activity.classes_:
        feat      = build_activity_features(w, act_name)
        raw_score = float(activity_model.predict(feat)[0])
        raw_score = max(0.0, min(10.0, raw_score))
        results.append({
            "activity":   act_name,
            "score":      round(raw_score, 2),
            "confidence": round(raw_score / 10.0, 3),
        })

    results.sort(key=lambda x: -x["score"])
    return results[:n]


# ── Activity display helpers ─────────────────────────────────────────────────
ACTIVITY_LABELS = {
    "commute":      "Good time to go out",
    "cycling":      "Nice for cycling",
    "driving":      "Good for driving",
    "outdoor_work": "Good for outdoor work",
    "picnic":       "Nice for a picnic",
    "running":      "Good for a run",
    "sports":       "Great for sports",
    "walking":      "Nice for a walk",
}

ACTIVITY_EMOJIS = {
    "commute":      "🚌",
    "cycling":      "🚴",
    "driving":      "🚗",
    "outdoor_work": "🛠️",
    "picnic":       "🧺",
    "running":      "🏃",
    "sports":       "⚽",
    "walking":      "🚶",
}


def build_recommendation_text(clothing: str, umbrella: bool,
                               temp: float, condition: str) -> str:
    label_map = {
        "heavy_winter_coat_gloves_hat":      "heavy winter coat, gloves & hat",
        "winter_coat_scarf_gloves":          "winter coat, scarf & gloves",
        "warm_jacket_layers":                "warm jacket with layers",
        "light_jacket_or_sweater":           "a light jacket or sweater",
        "long_sleeves_light_layer":          "long sleeves with a light layer",
        "t_shirt_comfortable":               "comfortable t-shirt",
        "light_breathable_clothing":         "light, breathable clothing",
        "very_light_clothing_stay_hydrated": "very light clothing!",
    }
    advice       = label_map.get(clothing, clothing.replace("_", " "))
    umbrella_txt = " Don't forget your umbrella!" if umbrella else ""
    return f"Wear {advice} ({temp:.0f}°C, {condition.replace('_', ' ')}).{umbrella_txt}"


def _compute_safety_feature_map(w: dict) -> dict:
    """
    Compute every possible safety feature from the weather dict w.
    Keys must exactly match the names saved in safety_feature_list.pkl.
    """
    h = w["hour_of_day"]
    m = w["month"]
    return {
        # ── Raw weather ──────────────────────────────────────────────────
        "temperature_c":   w["temperature_c"],
        "feels_like_c":    w["feels_like_c"],
        "humidity_pct":    w["humidity_pct"],
        "wind_speed_kmh":  w["wind_speed_kmh"],
        "wind_gust_kmh":   w["wind_gust_kmh"],
        "precipitation_mm": w["precipitation_mm"],
        "cloud_cover_pct": w["cloud_cover_pct"],
        "uv_index":        w["uv_index"],
        # ── Engineered ──────────────────────────────────────────────────
        "feels_delta":     w["feels_like_c"] - w["temperature_c"],
        "temp_humidity":   w["temperature_c"] * w["humidity_pct"] / 100,
        "wind_chill_idx":  w["wind_speed_kmh"] * (1 - w["temperature_c"] / 30),
        "is_cold":         int(w["temperature_c"] < 5),
        "is_hot":          int(w["temperature_c"] > 30),
        "is_precip":       int(w["precipitation_mm"] > 0),
        "high_wind":       int(w["wind_speed_kmh"] > 30),
        "high_uv":         int(w["uv_index"] > 6),
        "hour_sin":        math.sin(2 * math.pi * h / 24),
        "hour_cos":        math.cos(2 * math.pi * h / 24),
        "month_sin":       math.sin(2 * math.pi * m / 12),
        "month_cos":       math.cos(2 * math.pi * m / 12),
        "is_weekend":      w.get("is_weekend", 0),
    }


def build_safety_features(w: dict) -> np.ndarray:
    h = w["hour_of_day"]
    m = w["month"]
    return np.array([[
        # ── Raw (your original 8) ──────────────────────────
        w["temperature_c"],
        w["feels_like_c"],
        w["humidity_pct"],
        w["wind_speed_kmh"],
        w["wind_gust_kmh"],
        w["precipitation_mm"],
        w["cloud_cover_pct"],
        w["uv_index"],
        # ── Engineered (the 13 your model was trained with) ─
        w["feels_like_c"] - w["temperature_c"],                    # feels_delta
        w["temperature_c"] * w["humidity_pct"] / 100,              # temp_humidity
        w["wind_speed_kmh"] * (1 - w["temperature_c"] / 30),       # wind_chill_idx
        int(w["temperature_c"] < 5),                               # is_cold
        int(w["temperature_c"] > 30),                              # is_hot
        int(w["precipitation_mm"] > 0),                            # is_precip
        int(w["wind_speed_kmh"] > 30),                             # high_wind
        int(w["uv_index"] > 6),                                    # high_uv
        math.sin(2 * math.pi * h / 24),                            # hour_sin
        math.cos(2 * math.pi * h / 24),                            # hour_cos
        math.sin(2 * math.pi * m / 12),                            # month_sin
        math.cos(2 * math.pi * m / 12),                            # month_cos
        w.get("is_weekend", 0),                                    # is_weekend
    ]])

def predict_ml_insights(w: dict) -> MLInsights:
    X = build_safety_features(w)

    uv_pred        = uv_model.predict(X)[0]
    hydration_pred = hydration_model.predict(X)[0]
    road_pred      = road_model.predict(X)[0]
    wind_pred      = wind_alert_model.predict(X)[0]
    chill_pred     = wind_chill_model.predict(X)[0]
    outdoor_pred   = outdoor_model.predict(X)[0]

    return MLInsights(
        uvProtection     = UVProtection(label=["none", "sunglasses", "sunscreen"][int(uv_pred)]),
        hydrationAlert   = HydrationAlert(triggered=bool(hydration_pred)),
        roadSurface      = RoadSurface(label=["dry", "wet", "icy"][int(road_pred)]),
        windAlert        = WindAlert(triggered=bool(wind_pred)),
        windChillWarning = WindChillWarning(triggered=bool(chill_pred)),
        outdoorPoor      = OutdoorPoor(triggered=bool(outdoor_pred)),
    )


# ── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "models": ["clothing_rf", "umbrella_rf", "activity_gb_regressor",
                   "uv_model", "hydration_model", "road_model",
                   "wind_alert_model", "wind_chill_model", "outdoor_model"],
        "activity_model_r2": activity_meta.get("r2"),
    }


@app.post("/predict/all", response_model=PredictAllResponse)
def predict_all(req: PredictRequest):
    """
    Returns clothing recommendation + umbrella flag + top-3 activity suggestions
    + mlInsights from 6 safety models.
    """
    # 1. Fetch live weather
    try:
        raw = fetch_live_weather(req.lat, req.lon)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather API error: {e}")

    now = datetime.datetime.now()
    w   = parse_open_meteo(raw, now)

    # 2. Clothing + umbrella
    X_cloth = build_clothing_features(w)

    clothing_idx   = clothing_rf.predict(X_cloth)[0]
    clothing_label = clothing_le.inverse_transform([clothing_idx])[0]
    clothing_proba = float(clothing_rf.predict_proba(X_cloth)[0].max())

    umbrella_flag = bool(umbrella_rf.predict(X_cloth)[0])
    umbrella_conf = float(umbrella_rf.predict_proba(X_cloth)[0][1])

    # 3. Activity suggestions
    top3 = predict_top_activities(w, n=3)

    activity_suggestions = [
        ActivitySuggestion(
            activity   = item["activity"],
            confidence = item["confidence"],
            label      = ACTIVITY_LABELS.get(item["activity"],
                             item["activity"].replace("_", " ").title()),
            emoji      = ACTIVITY_EMOJIS.get(item["activity"], "🌤️"),
        )
        for item in top3
    ]

    # 4. Safety ML insights (6 models: A–F)
    ml_insights = predict_ml_insights(w)

    # 5. Friendly text
    rec_text = build_recommendation_text(
        clothing_label, umbrella_flag,
        w["temperature_c"], w["weather_condition"],
    )

    return PredictAllResponse(
        clothing_recommendation = clothing_label,
        clothing_confidence     = round(clothing_proba, 3),
        umbrella_needed         = umbrella_flag,
        umbrella_confidence     = round(umbrella_conf, 3),
        activity_suggestions    = activity_suggestions,
        temperature_c           = w["temperature_c"],
        feels_like_c            = w["feels_like_c"],
        weather_condition       = w["weather_condition"],
        hour_of_day             = w["hour_of_day"],
        season                  = w["season"],
        recommendation_text     = rec_text,
        mlInsights              = ml_insights,   # ← properly included
    )


# ── Keep old /predict endpoint working ──────────────────────────────────────
class PredictResponse(BaseModel):
    clothing_recommendation: str
    clothing_confidence:     float
    umbrella_needed:         bool
    umbrella_confidence:     float
    temperature_c:           float
    feels_like_c:            float
    weather_condition:       str
    hour_of_day:             int
    season:                  str
    recommendation_text:     str


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    result = predict_all(req)
    return PredictResponse(
        clothing_recommendation = result.clothing_recommendation,
        clothing_confidence     = result.clothing_confidence,
        umbrella_needed         = result.umbrella_needed,
        umbrella_confidence     = result.umbrella_confidence,
        temperature_c           = result.temperature_c,
        feels_like_c            = result.feels_like_c,
        weather_condition       = result.weather_condition,
        hour_of_day             = result.hour_of_day,
        season                  = result.season,
        recommendation_text     = result.recommendation_text,
    )