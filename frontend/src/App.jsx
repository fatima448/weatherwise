// src/App.jsx  — WeatherWise (refactored into components)
import { useState, useEffect, useRef } from "react";
import "./App.css";

// ── Services ──────────────────────────────────────────────────────────────
import {
  getWeather,
  getMLPredictionAll,
  getUserLocation,
  getCityName,
} from "./services/weather";

// ── Components ────────────────────────────────────────────────────────────
import Toast from "./components/Toast";
import WeatherCard from "./components/WeatherCard";
import SmartSuggestions from "./components/SmartSuggestions";
import ReschedulePanel from "./components/ReschedulePanel";
import CitySearch from "./components/CitySearch";

// ── Utils ─────────────────────────────────────────────────────────────────
import {
  getWeatherTheme,
  getGreeting,
  formatDate,
} from "./utils/weatherHelpers";

// ── Get local hour in a specific IANA timezone ────────────────────────────
// This is the key fix — always uses the CITY's timezone, not Turkey's
function getLocalHourInTz(timezone) {
  try {
    const n = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour:     "numeric",
        hour12:   false,
      }).format(new Date())
    );
    return isNaN(n) ? new Date().getHours() : n;
  } catch {
    return new Date().getHours();
  }
}
/* ── APP ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [toast, setToast] = useState(null);
  const [weather, setWeather] = useState(null);
  const [theme, setTheme] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [mlPred, setMlPred] = useState(null);
  const [mlError, setMlError] = useState(false);

  // Location state
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [cityName, setCityName] = useState("");
  const [cityTimezone, setCityTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [locating, setLocating] = useState(true); // true while getting GPS

  const fetchId = useRef(0);

  // ── On mount: try to get user's GPS location ────────────────────────────
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

  // ── When lat/lon changes: fetch weather + ML ───────────────────────────
   useEffect(() => {
    if (lat === null || lon === null) return;
 
    const thisId = ++fetchId.current;
 
    // KEY: do NOT set weather to null here
    // This means old city data stays on screen while new city loads → no flicker
    setMlPred(null);
    setMlError(false);
 
    getWeather(lat, lon)
      .then((data) => {
        if (thisId !== fetchId.current) return; // user searched another city, discard
 
        // Open-Meteo returns the city's timezone e.g. "America/New_York"
        const tz        = data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localHour = getLocalHourInTz(tz); // ← city's local hour, not Turkey's
        const isDay     = localHour >= 5 && localHour < 19;
 
        setCityTimezone(tz);
        setWeather(data);
        setTheme(getWeatherTheme(data.current.weathercode, isDay));
        setGreeting(getGreeting(localHour));
      })
      .catch((err) => console.error("Weather fetch failed:", err));
 
    getMLPredictionAll(lat, lon)
      .then((pred) => { if (thisId === fetchId.current) setMlPred(pred); })
      .catch(() => { if (thisId === fetchId.current) setMlError(true); });
 
  }, [lat, lon]);

  // ── City search handler (called by CitySearch component) ───────────────
  const handleCityChange = ({ lat, lon, cityName }) => {
    setLat(lat);
    setLon(lon);
    setCityName(cityName);
    setToast(`Showing weather for ${cityName}`);
  };

  // ── Loading screen ────────────────────────────────────────────────────
    if (locating) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "var(--font-d)", fontSize: 16, color: "#b89880",
      }}>
        📍 Getting your location…
      </div>
    );
  }
 
  if (!weather || !theme) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "var(--font-d)", fontSize: 16, color: "#b89880",
      }}>
        🌤️ Loading weather…
      </div>
    );
  }
 
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
            <CitySearch onCityChange={handleCityChange} toast={setToast} />
          </div>
 
          {/* timezone passed down so WeatherCard uses city's local time */}
          <WeatherCard
            current={weather.current}
            theme={theme}
            timezone={cityTimezone}
          />
 
          <SmartSuggestions mlPrediction={mlPred} weather={weather} />
        </main>
 
        <ReschedulePanel toast={setToast} lat={lat} lon={lon} weather={weather} />
      </div>
    </>
  );
}