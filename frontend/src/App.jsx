// src/App.jsx  — WeatherWise (updated: MLBadge + HourlyTimeline added)
// ONLY additions vs original:
//   - import MLBadge
//   - import HourlyTimeline
//   - [tasks, setTasks] state passed from ReschedulePanel (via prop drilling removed — see note)
//   - MLBadge placed in greet-row next to CitySearch
//   - HourlyTimeline placed between WeatherCard and SmartSuggestions
//
// NOTE: HourlyTimeline needs the tasks list. Since tasks live in ReschedulePanel,
// we lift tasks state up to App.jsx and pass it down as a prop.
// ReschedulePanel already accepts items via props if you add `tasks` + `setTasks` props.
// The simplest zero-refactor approach: HourlyTimeline reads DEFAULT_TASKS from a shared const.
// We use a shared ref callback pattern below — no restructuring needed.

import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

import {
  getWeather,
  getMLPredictionAll,
  getUserLocation,
  getCityName,
} from "./services/weather";

import Toast         from "./components/Toast";
import WeatherCard   from "./components/WeatherCard";
import SmartSuggestions from "./components/SmartSuggestions";
import ReschedulePanel  from "./components/ReschedulePanel";
import CitySearch    from "./components/CitySearch";
import MLBadge       from "./components/MLBadge";
import HourlyTimeline from "./components/HourlyTimeline";
import { runMLModels, openMeteoToMLInput } from "./services/mlModels";

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

export default function App() {
  const [toast, setToast]           = useState(null);
  const [weather, setWeather]       = useState(null);
  const [theme, setTheme]           = useState(null);
  const [greeting, setGreeting]     = useState("");
  const [mlPred, setMlPred]         = useState(null);
  const [mlError, setMlError]       = useState(false);
  const [mlInsights, setMlInsights] = useState(null);
  const [lat, setLat]               = useState(null);
  const [lon, setLon]               = useState(null);
  const [cityName, setCityName]     = useState("");
  const [cityTimezone, setCityTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [locating, setLocating] = useState(true);

  // ── Lifted tasks state so HourlyTimeline can see them ─────────────────
  // ReschedulePanel will call onTasksChange whenever its items list changes.
  const [tasks, setTasks] = useState([]);

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

        const mlInput = openMeteoToMLInput(data);
        const insights = runMLModels(mlInput);
        setMlInsights(insights);
      })
      .catch((err) => console.error("Weather fetch failed:", err));

    getMLPredictionAll(lat, lon)
      .then((pred) => {
        if (thisId === fetchId.current) setMlPred(pred);
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

            {/* Right side of greet row: MLBadge + CitySearch */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MLBadge mlInsights={mlInsights} />
              <CitySearch onCityChange={handleCityChange} toast={setToast} />
            </div>
          </div>

          <WeatherCard
            current={weather.current}
            theme={theme}
            timezone={cityTimezone}
          />

          {/* Hourly conflict timeline — shows tasks vs weather hour by hour */}
          <HourlyTimeline weather={weather} tasks={tasks} />

          <SmartSuggestions
            mlPrediction={mlPred}
            weather={weather}
            mlInsights={mlInsights}
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
