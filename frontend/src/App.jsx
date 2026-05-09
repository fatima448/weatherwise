// src/App.jsx — WeatherWise

import { useState, useEffect, useRef } from "react";
import "./App.css";

import {
  getWeather,
  getMLPredictionAll,
  getUserLocation,
  getCityName,
} from "./services/weather";

import Toast from "./components/Toast";
import WeatherCard from "./components/WeatherCard";
import SmartSuggestions from "./components/SmartSuggestions";
import ReschedulePanel from "./components/ReschedulePanel";
import CitySearch from "./components/CitySearch";
import HourlyTimeline from "./components/HourlyTimeline";
import MLBadge from "./components/MLBadge";

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

function extractMlInsights(mlPred) {
  if (!mlPred) return null;

  if (mlPred.mlInsights && typeof mlPred.mlInsights === "object") {
    return mlPred.mlInsights;
  }

  const INSIGHT_KEYS = [
    "uvProtection",
    "hydrationAlert",
    "roadSurface",
    "windAlert",
    "windChillWarning",
    "outdoorPoor",
  ];
  const hasInsightKeys = INSIGHT_KEYS.some((k) => k in mlPred);
  if (hasInsightKeys) {
    return Object.fromEntries(INSIGHT_KEYS.map((k) => [k, mlPred[k] ?? {}]));
  }

  return null;
}

export default function App() {
  const [toast, setToast] = useState(null);
  const [weather, setWeather] = useState(null);
  const [theme, setTheme] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [mlPred, setMlPred] = useState(null);
  const [mlError, setMlError] = useState(false);
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [cityName, setCityName] = useState("");
  const [cityTimezone, setCityTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [locating, setLocating] = useState(true);
  const [tasks, setTasks] = useState([]);

  const fetchId = useRef(0);
  
  const topRef = useRef(null);
 
  const hasScrolled = useRef(false);

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
        const tz =
          data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
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
          setMlPred(pred);
        }
      })
      .catch(() => {
        if (thisId === fetchId.current) setMlError(true);
      });
  }, [lat, lon]);

  
  useEffect(() => {
    if (!weather || hasScrolled.current) return;
    hasScrolled.current = true;

    const timer = setTimeout(() => {
     
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: "instant", block: "start" });
      }
      
      try { window.scrollTo(0, 0); } catch (_) {}
      
      try { document.documentElement.scrollTop = 0; } catch (_) {}
      try { document.body.scrollTop = 0; } catch (_) {}
    }, 300);

    return () => clearTimeout(timer);
  }, [weather]);

  const handleCityChange = ({ lat, lon, cityName }) => {
    setLat(lat);
    setLon(lon);
    setCityName(cityName);
    setToast(`Showing weather for ${cityName}`);
  };

  if (locating) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "var(--font-d)",
          fontSize: 16,
          color: "#b89880",
        }}
      >
        📍 Getting your location…
      </div>
    );
  }

  if (!weather || !theme) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "var(--font-d)",
          fontSize: 16,
          color: "#b89880",
        }}
      >
        🌤️ Loading weather…
      </div>
    );
  }

  const mlInsights = extractMlInsights(mlPred);

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      {/* topRef on the outermost div — guaranteed to be the very top of the page */}
      <div ref={topRef} className="app-shell">
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

          <HourlyTimeline
            weather={weather}
            tasks={tasks}
            timezone={cityTimezone}
          />

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