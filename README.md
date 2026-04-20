# WeatherWise

A weather-aware task planner that combines real-time forecasts, ML predictions, and smart conflict detection to help you plan your day around the weather.

---

## Features

- **Live weather** via Open-Meteo (temperature, humidity, UV, wind, precipitation)
- **Hourly Timeline** — next 12 hours with human-readable weather labels, task overlays, and red conflict badges
- **Task conflict detection** — detects when a scheduled task clashes with bad weather at that exact hour
- **Smart Suggestions** — ML-powered clothing, umbrella, activity recommendations, and a 6-hour weather alert
- **Add/reschedule tasks** — Gemini AI classifies tasks and checks forecast conflicts on add
- **Weather chat** — conversational assistant aware of your tasks and current conditions
- **City search** — switch to any city, all views update to that city's local time

---

## Project Structure

```
difawehaterwiese/
├── backend/
│   ├── server.py               # FastAPI ML backend
│   ├── requirements.txt
│   └── models/
│       ├── clothing_model.pkl
│       ├── umbrella_model.pkl
│       ├── label_encoders.pkl
│       ├── feature_metadata.pkl
│       ├── activity_model.pkl
│       ├── activity_label_encoders.pkl
│       └── activity_metadata.pkl
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   ├── components/
    │   │   ├── WeatherCard.jsx
    │   │   ├── HourlyTimeline.jsx
    │   │   ├── SmartSuggestions.jsx
    │   │   ├── ReschedulePanel.jsx
    │   │   ├── WeatherChat.jsx
    │   │   ├── CitySearch.jsx
    │   │   └── Toast.jsx
    │   ├── services/
    │   │   ├── weather.js       # Open-Meteo + ML backend calls
    │   │   └── gemini.js        # Gemini 2.0 Flash (conflict classify + chat)
    │   ├── utils/
    │   │   └── weatherHelpers.js
    │   └── data/
    │       └── emojiMap.js
    ├── .env
    ├── package.json
    └── vite.config.js
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.10+
- A Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com)

---

### 1. Backend

```bash
cd backend
pip install fastapi==0.111.0 uvicorn[standard]==0.29.0 scikit-learn>=1.4.0 joblib>=1.3.0 numpy>=1.26.0 requests>=2.31.0 pydantic>=2.0.0
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be available at `http://localhost:8000`.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/predict` | Clothing + umbrella prediction |
| POST | `/predict/all` | Clothing + umbrella + top activity suggestions |
| GET | `/health` | Health check |

Both POST endpoints accept `{ "lat": float, "lon": float }`.

---

### 2. Frontend

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` directory:

```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Then start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

> The app requests your browser's geolocation on load. If denied, it defaults to Istanbul.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GEMINI_API_KEY` | Yes | Gemini 2.0 Flash API key for task classification and chat |

The ML backend and Open-Meteo weather API require no keys.

---

## How It Works

### Weather Data
Open-Meteo provides current conditions and hourly forecasts for 24 hours. All timestamps are returned in the **city's local timezone** — the app parses these directly from the string (`"2025-04-20T14:00"`) rather than via `new Date()` to avoid browser timezone conversion errors.

### ML Backend
Three scikit-learn models run locally:

- **clothing_model** (RandomForest) — predicts clothing category from weather features
- **umbrella_model** (RandomForest) — predicts `umbrella_needed: bool` + confidence score
- **activity_model** (GradientBoostingRegressor) — scores activity types by suitability

### Task Conflict Detection
When you add a task, the app:
1. Fetches the forecast for that exact hour from Open-Meteo
2. Sends the task name + forecast to Gemini 2.0 Flash, which returns `isOutdoor`, `hasConflict`, `conflictReason`, and a suggested fix
3. If Gemini is unavailable, falls back to raw weather thresholds (rain > 50%, wind > 40 km/h, storm code ≥ 95)
4. If a conflict is found, a **red toast alert** appears immediately and the task is highlighted in the Hourly Timeline

### Smart Suggestions (Card 2 — Umbrella)
The umbrella card uses `shouldBringUmbrella()` which checks **both**:
- `mlPrediction.umbrella_needed` from the ML model
- Raw weather code (≥ 51 = rain/snow/storm) as a fallback

This means it works even when the ML backend is offline.

---

## Building for Production

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. Serve it with any static host or the included Vite preview:

```bash
npm run preview
```

---

## External APIs Used

| Service | Purpose | Cost |
|---------|---------|------|
| [Open-Meteo](https://open-meteo.com) | Weather + hourly forecast | Free |
| [Nominatim (OSM)](https://nominatim.openstreetmap.org) | Reverse geocoding (lat/lon → city name) | Free |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City name → lat/lon search | Free |
| [Gemini 2.0 Flash](https://aistudio.google.com) | Task classification + weather chat | Free tier available |

---

## Recent Changes

These files were modified to fix the hourly timeline sync and add umbrella suggestion:

| File | What changed |
|------|-------------|
| `HourlyTimeline.jsx` | Fixed timezone bug (parses timestamps as strings, not via `new Date()`); added `timezone` prop; added human-readable weather labels; added live conflict re-check on render |
| `App.jsx` | Passes `timezone={cityTimezone}` to `HourlyTimeline` |
| `SmartSuggestions.jsx` | Added umbrella card (Card 2) using existing ML model + `shouldBringUmbrella()`; alert moved to Card 4 |
