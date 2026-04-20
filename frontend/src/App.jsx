// src/App.jsx — WeatherWise
// FIX: mlInsights extraction — tries mlPred.mlInsights first, then falls back
// to mlPred itself in case the service returns insights at the top level.

import { useState, useEffect, useRef } from "react";
import "./App.css";

import {
  getWeather,
  getMLPredictionAll,
  getUserLocation,
  getCityName,
} from "./services/weather";

import Toast            from "./components/Toast";
import WeatherCard      from "./components/WeatherCard";
import SmartSuggestions from "./components/SmartSuggestions";
import ReschedulePanel  from "./components/ReschedulePanel";
import CitySearch       from "./components/CitySearch";
import HourlyTimeline   from "./components/HourlyTimeline";
import MLBadge          from "./components/MLBadge";

import {
  getWeatherTheme,
  getGreeting,
  formatDate,
} from "./utils/weatherHelpers";

function getLocalHourInTz(timezone) {
  try {
    const n = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
    return isNaN(n) ? new Date().getHours() : n;
  } catch {
    return new Date().getHours();
  }
}

// ── Extract the 6 GB model outputs from whatever shape the service returns ──
// getMLPredictionAll may return:
//   { mlInsights: { uvProtection, hydrationAlert, ... }, clothing_recommendation, ... }
// OR it may return:
//   { uvProtection, hydrationAlert, ..., clothing_recommendation, ... }   (flat)
// We handle both.
function extractMlInsights(mlPred) {
  if (!mlPred) return null;

  // If there's an explicit mlInsights sub-object, use it
  if (mlPred.mlInsights && typeof mlPred.mlInsights === "object") {
    return mlPred.mlInsights;
  }

  // Otherwise check if the 6 expected keys exist directly on mlPred
  const INSIGHT_KEYS = [
    "uvProtection", "hydrationAlert", "roadSurface",
    "windAlert", "windChillWarning", "outdoorPoor",
  ];
  const hasInsightKeys = INSIGHT_KEYS.some((k) => k in mlPred);
  if (hasInsightKeys) {
    // Return a sub-object with just those keys so the rest of the app
    // doesn't get confused by clothing_recommendation etc.
    return Object.fromEntries(
      INSIGHT_KEYS.map((k) => [k, mlPred[k] ?? {}])
    );
  }

  // Couldn't find them — return null so cards show loading state
  return null;
}

export default function App() {
  const [toast, setToast]           = useState(null);
  const [weather, setWeather]       = useState(null);
  const [theme, setTheme]           = useState(null);
  const [greeting, setGreeting]     = useState("");
  const [mlPred, setMlPred]         = useState(null);
  const [mlError, setMlError]       = useState(false);
  const [lat, setLat]               = useState(null);
  const [lon, setLon]               = useState(null);
  const [cityName, setCityName]     = useState("");
  const [cityTimezone, setCityTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [locating, setLocating] = useState(true);
  const [tasks, setTasks]       = useState([]);

  const fetchId = useRef(0);

  useEffect(() => {
    getUserLocation()
      .then(async ({ lat, lon }) => {
        setLat(lat);
        setLon(lon);
        try {
          const name = await getCityName(lat, lon);
          setCityName(name);
        } catch {
          setCityName("Your Location");
        }
      })
      .catch(() => {
        setLat(41.01);
        setLon(28.97);
        setCityName("Istanbul");
      })
      .finally(() => setLocating(false));
  }, []);

  useEffect(() => {
    if (lat === null || lon === null) return;

    const thisId = ++fetchId.current;
    setMlPred(null);
    setMlError(false);

    getWeather(lat, lon)
      .then((data) => {
        if (thisId !== fetchId.current) return;
        const tz = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localHour = getLocalHourInTz(tz);
        const isDay = localHour >= 5 && localHour < 19;
        setCityTimezone(tz);
        setWeather(data);
        setTheme(getWeatherTheme(data.current.weathercode, isDay));
        setGreeting(getGreeting(localHour));
      })
      .catch((err) => console.error("Weather fetch failed:", err));

    getMLPredictionAll(lat, lon)
      .then((pred) => {
        if (thisId === fetchId.current) {
          // Log once so you can inspect the shape in DevTools
          console.log("[WeatherWise] mlPred shape:", JSON.stringify(pred, null, 2));
          setMlPred(pred);
        }
      })
      .catch(() => {
        if (thisId === fetchId.current) setMlError(true);
      });
  }, [lat, lon]);

  const handleCityChange = ({ lat, lon, cityName }) => {
    setLat(lat);
    setLon(lon);
    setCityName(cityName);
    setToast(`Showing weather for ${cityName}`);
  };

  if (locating) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "var(--font-d)", fontSize: 16, color: "#b89880" }}>
        📍 Getting your location…
      </div>
    );
  }

  if (!weather || !theme) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "var(--font-d)", fontSize: 16, color: "#b89880" }}>
        🌤️ Loading weather…
      </div>
    );
  }

  // Derive mlInsights using the smart extractor
  const mlInsights = extractMlInsights(mlPred);

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      <div className="app-shell">
        <main className="main-content">

          <div className="greet-row">
            <div className="greet-container">
              <div className="greet-name">{greeting} 👋</div>
              <div className="greet-date">
                {formatDate(weather.current.time)}
                {cityName && (
                  <span className="greet-city"> · 📍 {cityName}</span>
                )}
              </div>
            </div>

            <div className="greet-controls">
              <MLBadge mlInsights={mlInsights} mlPrediction={mlPred} />
              <CitySearch onCityChange={handleCityChange} toast={setToast} />
            </div>
          </div>

          <WeatherCard
            current={weather.current}
            theme={theme}
            timezone={cityTimezone}
          />

          <HourlyTimeline weather={weather} tasks={tasks} timezone={cityTimezone} />

          <SmartSuggestions
            mlPrediction={mlPred}
            mlInsights={mlInsights}
            weather={weather}
            timezone={cityTimezone}
          />
        </main>

        <ReschedulePanel
          toast={setToast}
          lat={lat}
          lon={lon}
          weather={weather}
          onTasksChange={setTasks}
        />
      </div>
    </>
  );
}