# 🌤️ WeatherWise — AI-Powered Weather Task Planner

> **Hackathon Submission — Team 038 · Sivas Hackathon 2026**

WeatherWise is a real-time weather application that uses **6 custom-trained ML models** and **Google Gemini AI** to help you plan your day smarter — detecting conflicts between your tasks and the weather before they happen.

---

## ✨ Features

### 🤖 6 Gradient Boosting ML Models (client-side, zero latency)
All models trained on **43,440 real weather observations** with F1 scores ≥ 0.989:

| Model | What it predicts |
|---|---|
| A — UV Protection | None / Sunglasses / Sunscreen |
| B — Hydration Alert | Drink water warning |
| C — Road Surface | Dry / Wet / Icy |
| D — Wind Alert | Dangerous gust detection |
| E — Wind Chill | Feels colder than it looks |
| F — Outdoor Conditions | Poor outdoor suitability |

### 🌦️ Hourly Conflict Timeline
Visual hour-by-hour strip showing your tasks overlaid on the weather forecast — conflicts highlighted in red at a glance.

### ⚠️ Smart Task Conflict Detection
Add any task → Gemini AI automatically determines:
- Is this outdoor or indoor?
- What weather conditions would make it hard?
- Is there a conflict right now?
- What's the best fix?

### 💬 AI Weather Chat
Multi-turn conversational assistant that knows your tasks, your schedule, and today's weather — like a friend who checked everything for you.

### 🔍 Personalized Insights
3 AI-generated insights per session, updated when weather or your tasks change. Debounced and cached to minimize API cost.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+ (for the ML backend)
- A free [Google Gemini API key](https://aistudio.google.com/app/apikey)

### 1. Clone the repo
```bash
git clone https://github.com/your-team/weatherwise.git
cd weatherwise
```

### 2. Set up the frontend
```bash
cd frontend
```

Create a `.env` file:
```
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

Install and run:
```bash
npm install
npm run dev
```

### 3. Set up the backend (optional — for ML clothing/activity predictions)
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### 4. Build for production
```bash
cd frontend
npm run build
```
Upload the `dist/` folder to your server.

---

## 🏗️ Architecture

```
Browser
  ├── React Frontend (Vite)
  │     ├── 6 ML Models (pure JS, client-side)
  │     ├── Gemini 2.0 Flash API (task classification + insights + chat)
  │     └── Open-Meteo API (free weather + hourly forecast)
  └── Python Backend (FastAPI)
        └── Clothing & activity predictions
```

### Why client-side ML?
All 6 Gradient Boosting models run **directly in the browser** — no server needed. This means:
- ⚡ Zero latency (instant predictions)
- 💰 Zero cost (no API calls)
- 🌐 Works offline once loaded

---

## 💡 AI Cost Strategy

To keep Gemini API usage minimal:
- **Task classification**: 1 call per task added (~150 tokens)
- **Insights**: Generated with a **3-second debounce** + **60-second cooldown** — so adding multiple tasks fires only 1 call, not many
- **Chat**: Only on explicit user message
- **Fallbacks**: Every Gemini call has a rule-based fallback if the API is unavailable

Estimated daily cost on free tier (1,500 req/day): supports ~300 active users/day comfortably.

---

## 📁 Project Structure

```
frontend/
  src/
    components/
      MLBadge.jsx          ← NEW: floating AI model status button
      HourlyTimeline.jsx   ← NEW: hourly weather + task conflict visual
      ReschedulePanel.jsx  ← Tasks + insights + chat panel
      SmartSuggestions.jsx ← ML-powered suggestion cards
      WeatherCard.jsx      ← Current conditions card
      WeatherChat.jsx      ← AI chat assistant
      CitySearch.jsx       ← City search input
    services/
      gemini.js            ← All Gemini AI calls
      mlModels.js          ← 6 client-side ML models
      weather.js           ← Open-Meteo + geolocation
    utils/
      weatherHelpers.js    ← Theming, alerts, formatting
backend/
  server.py                ← FastAPI ML prediction server
```

---

## 🌐 Live Demo

**[team-038.hackaton.sivas.edu.tr](https://team-038.hackaton.sivas.edu.tr)**

---

## 👥 Team

**Team 038** — Sivas Hackathon 2026

