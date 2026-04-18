# 🌦️ WeatherWise

**Developer README & Change Log**
📅 April 2026 · Hackathon Build

---

## 📌 Project Overview

**WeatherWise** is a real-time weather intelligence app that converts raw weather data into actionable advice.

Instead of just showing temperature, it helps users:

* 👕 Decide what to wear
* ☔ Know if they need an umbrella
* 🏃 Choose suitable activities
* ⚠️ Get alerts about upcoming weather changes

A machine learning backend built with **FastAPI + Random Forest** powers the recommendations.

---

## 🗂️ Project Structure

### 📁 Frontend (`src/`)

```
src/
├── App.jsx
├── App.css
├── services/
│   └── weather.js
├── utils/
│   └── weatherHelpers.js
├── data/
│   └── emojiMap.js
└── components/
    ├── Toast.jsx
    ├── WeatherCard.jsx
    ├── CitySearch.jsx
    ├── SmartSuggestions.jsx
    └── ReschedulePanel.jsx
```

### ⚙️ Backend

```
server.py
models/
├── clothing_model.pkl
├── umbrella_model.pkl
├── activity_model.pkl
├── label_encoders.pkl
├── activity_encoders.pkl
└── feature_metadata.pkl
```

---

## 🔄 Change Log

---

### ✅ Change 1 — Component Refactor

**Problem:**
`App.jsx` was ~670 lines → hard to maintain

**Solution:**

* Reduced to ~90 lines
* Split into reusable components
* Moved helpers to `utils/`
* Moved API calls to `services/`

**Result:**
✔ Clean structure
✔ Easier debugging
✔ Better scalability

---

### 📍 Change 2 — Automatic User Location

**Before:**

* Always showed Istanbul (hardcoded)

**Now:**

* Uses browser **Geolocation API**
* Falls back to Istanbul if denied

**APIs Used:**

* Browser Geolocation
* Nominatim (reverse geocoding)
* Open-Meteo (search)

---

### 🏙️ Change 3 — City Name in Header

Now displays:

```
Saturday, April 18 · 📍 Istanbul
```

✔ Updates dynamically when user searches a city

---

### ☔ Change 4 — Umbrella Bug Fix

**Problem:**
ML sometimes said “No umbrella” during rain

**Fix:**
Added rule-based fallback:

```js
export function shouldBringUmbrella(mlPrediction, weatherCode) {
  const isRainingNow = weatherCode >= 51 && weatherCode <= 99;
  return isRainingNow || mlPrediction?.umbrella_needed === true;
}
```

✔ Real weather overrides ML mistakes

---

### 🏃 Change 5 — Activity Suggestions Fix

**Problem:**
Outdoor activities suggested during rain

**Fix:**

* Penalize outdoor activities
* Boost indoor ones

```js
const OUTDOOR_ACTIVITIES = new Set([
  'running', 'cycling', 'walking', 'picnic', 'sports', 'outdoor_work'
]);
```

✔ Smarter, realistic recommendations

---

### ⚠️ Change 6 — Weather Alert Card

Replaced static hourly data with smart alerts:

**Alert Types:**

* 🌧️ Rain coming
* ⛈️ Storm approaching
* 🌡️ Temperature drop
* 💨 Strong winds
* ❄️ Snow expected
* ✅ Stable weather

✔ Color-coded alerts (blue, red, amber, green)

---

## 🚀 How to Run

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
pip install fastapi uvicorn joblib numpy requests
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Train Model (one-time)

```bash
python train_activity_model.py
```

---

## 🔗 APIs Used

All free (no API key required):

* Open-Meteo (weather + forecast)
* Open-Meteo Geocoding
* Nominatim (OpenStreetMap)
* Browser Geolocation API

---

## 🤖 ML Endpoints

* `POST /predict/all` → clothing + umbrella + activities
* `POST /predict` → clothing + umbrella
* `GET /health` → model status

---

## 💡 Key Highlights

* Real-time weather intelligence
* ML-powered recommendations
* Smart fallback logic (rule + ML)
* Clean, scalable architecture

---

## 👩‍💻 Developer Notes

This project focuses on:

* Clean architecture
* Practical ML usage (not over-engineered)
* Real-world usability over theory

---

✨ Built for a hackathon, designed like a startup product.
