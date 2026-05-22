# WeatherWise 

> **Anadolu Hackathon 2026** — hosted by Sivas University of Science and Technology, supported by Yandex Türkiye.

An AI-powered weather app that converts raw forecasts into instant, actionable decisions — what to wear, whether to grab an umbrella, which activities suit the weather, and whether your scheduled tasks will clash with the forecast at that exact hour. Built from scratch in a few days by **Dima & Fatmah**.

---

## What it does

Most weather apps show you numbers. WeatherWise tells you what to *do* with them.

In under 60 seconds a user can:

1. Open the app → see a live weather summary with human-readable labels and a dynamic theme (sunny/rainy/stormy)
2. Get smart outfit and umbrella suggestions powered by ML
3. Add tasks for the day (morning coffee run, gym, outdoor lunch, evening drive)
4. See which tasks clash with the weather **at that exact scheduled hour**, highlighted in red
5. Reschedule in seconds and move on

---

## ML architecture — 9 models

The backend runs **9 scikit-learn models** loaded into memory at FastAPI startup, split into two layers.

### Core prediction layer (3 models)

| Model | Algorithm | Input | Output |
|-------|-----------|-------|--------|
| `clothing_model` | Random Forest Classifier | 34 engineered weather features | 1 of 8 clothing categories |
| `umbrella_model` | Random Forest Classifier | Same 34 features | `umbrella_needed: bool` + confidence % |
| `activity_model` | Gradient Boosting Regressor | 23 features incl. time of day + activity type | Activities ranked 0–10, top 3 returned if ≥ 60% confidence |

**The 8 clothing categories** (coldest → hottest):

```
heavy_winter_coat_gloves_hat → winter_coat_scarf_gloves → warm_jacket_layers
→ light_jacket_or_sweater → long_sleeves_light_layer → t_shirt_comfortable
→ light_breathable_clothing → very_light_clothing_stay_hydrated
```

**The 10 activity categories:** commute · cycling · driving · outdoor_work · outdoor_active · work · picnic · running · sports · walking

**Feature engineering highlights:**
- 34 features for the clothing/umbrella models including: `temperature_c`, `feels_like_c`, `feels_delta`, `humidity_pct`, `wind_speed_kmh`, `wind_gust_kmh`, `uv_index`, `precipitation_mm`, `cloud_cover_pct`, and 10+ derived/binary features
- **Circular encoding** for hour and month: instead of passing raw integers (where the model would think midnight and 11 PM are 23 apart), we encode as `sin(2π·h/24)` and `cos(2π·h/24)` — so the model understands that 23:00 and 00:00 are 1 hour apart
- **Custom wind chill index:** `wind_speed × (1 - temperature / 30)`
- **Interaction terms:** `temperature × humidity / 100` (heat index)
- Binary flags: `is_cold`, `is_hot`, `is_precip`, `high_wind`, `is_thunderstorm`, `is_weekend`

### Safety insights layer (6 models — `model_A` through `model_F`)

Each model is a separate classifier trained on 21 engineered weather features and answers one focused safety question:

| Model | Question | Output |
|-------|----------|--------|
| `model_A` — UV Protection | Sun risk level? | `none` / `sunglasses` / `sunscreen` |
| `model_B` — Hydration Alert | Should you drink more water? | `triggered: bool` |
| `model_C` — Road Surface | What are road conditions like? | `dry` / `wet` / `icy` |
| `model_D` — Wind Alert | Is wind dangerous enough to flag? | `triggered: bool` |
| `model_E` — Wind Chill Warning | Does it feel much colder than it is? | `triggered: bool` |
| `model_F` — Outdoor Conditions | Is it generally poor to be outside? | `triggered: bool` |

All 6 share the same 21-feature input vector and are called in a single `/predict/all` endpoint alongside the 3 core models. The frontend receives all 9 model outputs in one response.

---

## How conflict detection works

When a user adds a task:

1. The frontend calls `getForecastAtHour(lat, lon, hour)` — fetching the **exact hourly forecast** for when that task is scheduled, not a general daily forecast
2. That forecast is sent to **Gemini 2.0 Flash** with a structured prompt asking it to: classify the task as `indoor` or `outdoor`, then decide if the weather creates a conflict
3. Gemini returns `{ type, conflict, reason, suggestion }` — the `reason` appears as the red alert text on the task card
4. If Gemini is unavailable → a **rule-based fallback** kicks in: `weathercode >= 95` (thunderstorm) = conflict
5. A separate `applyOverlapConflicts()` function also checks for tasks scheduled at the same hour as each other — when both weather and overlap conflicts apply, the weather reason takes priority in the message shown

---

## LLM layer

Two endpoints powered by an LLM (via OpenRouter / LLaMA 3.3 70B):

- **`/chat`** — multi-turn chat assistant. Each request includes the user's full task list (with conflict flags) and current weather. The model can answer "Should I still run at 6 PM?" with real context.
- **`/conditions`** — given current weather + ML predictions, returns a friendly one-sentence summary and 3 practical tips. This powers the "Weather looks stable" text in the Smart Suggestions panel.

The LLM does **not** handle clothing, umbrella, activity, or safety predictions — those are entirely the scikit-learn models.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Styling | Custom CSS (no component library) |
| Backend | FastAPI + Python + Uvicorn |
| ML models | scikit-learn (RandomForest, GradientBoosting) stored as `.pkl` files |
| LLM | OpenRouter → LLaMA 3.3 70B (free tier) |
| Conflict classification | Gemini 2.0 Flash |
| Weather data | Open-Meteo (free, no API key needed) |
| Geocoding | Nominatim (reverse) + Open-Meteo Geocoding |
| Total API cost | Essentially zero |

---

## Project structure

```
weatherwise-main/
├── backend/
│   ├── server.py                      # FastAPI app — all ML logic and endpoints
│   ├── requirements.txt
│   └── models/
│       ├── clothing_model.pkl         # Random Forest — clothing prediction
│       ├── umbrella_model.pkl         # Random Forest — umbrella prediction
│       ├── activity_model.pkl         # Gradient Boosting — activity ranking
│       ├── label_encoders.pkl         # Encoders for clothing/umbrella categorical features
│       ├── feature_metadata.pkl       # Feature list for clothing/umbrella models
│       ├── activity_label_encoders.pkl
│       ├── activity_metadata.pkl
│       ├── model_A.pkl                # UV protection classifier
│       ├── model_B.pkl                # Hydration alert classifier
│       ├── model_C.pkl                # Road surface classifier
│       ├── model_D.pkl                # Wind alert classifier
│       ├── model_E.pkl                # Wind chill warning classifier
│       ├── model_F.pkl                # Outdoor conditions classifier
│       └── safety_feature_list.pkl    # Feature list for safety models
└── frontend/
    └── src/
        ├── App.jsx                    # Root component — orchestrates everything
        ├── App.css                    # All styles (hand-crafted, ~600 lines)
        ├── components/
        │   ├── WeatherCard.jsx        # Live weather card with dynamic theme
        │   ├── HourlyTimeline.jsx     # Timezone-aware 12-hour forecast strip with task overlay
        │   ├── SmartSuggestions.jsx   # 4-card ML suggestions grid
        │   ├── MLBadge.jsx            # "8 AI Models" dropdown panel
        │   ├── ReschedulePanel.jsx    # Task manager with conflict detection
        │   ├── WeatherChat.jsx        # LLM chat assistant
        │   ├── CitySearch.jsx         # City search with geocoding
        │   └── Toast.jsx              # Notification popup
        ├── services/
        │   ├── weather.js             # Open-Meteo + ML backend API calls
        │   └── gemini.js              # Gemini conflict classification
        ├── utils/
        │   └── weatherHelpers.js      # Pure helpers: themes, alerts, umbrella logic, activity filtering
        └── data/
            └── emojiMap.js            # Task label → emoji mapping
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com)
- A free OpenRouter API key from [openrouter.ai](https://openrouter.ai) (for the chat assistant)

### 1. Backend

```bash
cd backend
pip install fastapi uvicorn scikit-learn joblib numpy requests pydantic httpx python-dotenv
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
Loading safety models...
Loading clothing + umbrella models...
Loading activity model...
✅ All models loaded
```

**API endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns all 9 model names + activity model R² |
| `POST` | `/predict/all` | Main endpoint — clothing + umbrella + activities + 6 safety insights |
| `POST` | `/predict` | Legacy — clothing + umbrella only |
| `POST` | `/chat` | Multi-turn LLM chat with weather + task context |
| `POST` | `/conditions` | LLM-generated weather summary + tips |

Both POST prediction endpoints accept: `{ "lat": float, "lon": float }`

### 2. Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/`:

```
VITE_GEMINI_API_KEY=your_gemini_key_here
```

Create a `.env` file in `backend/`:

```
OPENROUTER_API_KEY=your_openrouter_key_here
```

Then start:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The app requests browser geolocation on load — if denied, it defaults to Istanbul (lat 41.01, lon 28.97).

---

## How the hourly timeline works

The `HourlyTimeline` component has a non-obvious but important timezone fix.

Open-Meteo returns timestamps like `"2025-04-20T14:00"` in the **city's local time**, not UTC. If you parse these with `new Date(t).getHours()` directly, the browser converts them to your local timezone — wrong if you're checking weather for a different city.

The fix: a `getHourInTz(isoString, timezone)` function that uses `Intl.DateTimeFormat` with the city's IANA timezone to extract the correct local hour, completely ignoring browser timezone. This means the 14:00 slot for London weather always shows 14:00 even if you're in Istanbul.

---

## External services

| Service | Purpose | Cost |
|---------|---------|------|
| [Open-Meteo](https://open-meteo.com) | Weather + hourly forecast (24h) | Free |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City name → lat/lon | Free |
| [Nominatim (OSM)](https://nominatim.openstreetmap.org) | lat/lon → city name | Free |
| [Gemini 2.0 Flash](https://aistudio.google.com) | Task conflict classification | Free tier |
| [OpenRouter](https://openrouter.ai) | LLM chat + conditions summary | Free tier (LLaMA 3.3 70B) |

---

## Known limitations

These are honest constraints of what was built during the hackathon — not bugs, but real boundaries worth knowing.

**No personalisation.** The 9 ML models were trained on generic weather datasets, not on individual user behaviour. "Strong gusts" means the same thing whether the user is a cyclist or works indoors all day. The models have no concept of who the user is.

**Conflict detection relies on task names.** Gemini classifies tasks as indoor or outdoor based on their label — "evening run" works well, but "sort out the thing" or "pick up Ahmed" gives Gemini nothing to work with. There is no way for users to tag tasks manually as indoor/outdoor.

**Safety alerts are collapsed to one message.** If UV, wind, and road surface are all triggered simultaneously, the UI shows only the highest-priority alert. The others are silently dropped. A user could miss that roads are icy because a wind alert ranked higher.


**The ML backend must run locally.** `ML_BACKEND_URL` is hardcoded to `http://localhost:8000`. Deploying the frontend without deploying the backend means the ML features silently fall back to the rule-based UI.

---

## What's next

Roughly ordered by impact:

**Persist tasks.** Add `localStorage` in `ReschedulePanel` — save the task list on every `setItems` call, load it on mount. This alone makes the app feel real instead of demo-like.

**Let users tag tasks as indoor / outdoor.** Add a simple toggle when adding a task. This removes the dependency on Gemini guessing from a label and makes conflict detection accurate for any task name.

**Show all active safety alerts, not just one.** When multiple safety models trigger, list them all rather than picking the top priority. The user deserves to see that both wind and icy roads are flagged at the same time.

**Suggest a better time slot.** When a conflict is detected, scan the next 12 hours for a clear window and surface it — "conflict at 6 PM, try 4 PM instead." The `getForecastAtHour()` function is already written and ready to support this.

**Deploy the backend.** Host the FastAPI server on Railway, Render, or Fly.io. Update `ML_BACKEND_URL` in `weather.js` to the live URL so the app works for anyone without a local Python setup.

**Retrain models on larger, more diverse datasets.** The current models were trained on a single city's climate profile. Training on data from multiple climate zones would make predictions generalisable anywhere in the world.

**Push notifications for weather changes.** If the forecast changes significantly after a user has set their tasks, notify them — especially for conflicts that didn't exist when the task was added.

**Multi-day planning.** Extend the backend to fetch and run ML predictions across a 7-day window so users can plan further ahead than 24 hours.

---

## Built by

**Dima & Fatima** — Anadolu Hackathon 2026
