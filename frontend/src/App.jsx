// src/App.jsx  — WeatherWise with ML clothing recommendations
import { useState, useEffect } from "react";
import "./App.css";
import { getWeather, getMLPrediction, clothingLabel } from "./services/weather";

/* ── DATA ── */
const RESCHEDULE_ITEMS = [
  { id: 1, label: "Evening Run",    time: "6:00 PM", icon: "🏃", conflict: true,  fix: "Move to 3:30 PM — clear skies" },
  { id: 2, label: "Walk the Dog",   time: "5:00 PM", icon: "🐕", conflict: false, fix: "" },
  { id: 3, label: "Outdoor Lunch",  time: "1:00 PM", icon: "🍱", conflict: false, fix: "" },
  { id: 4, label: "Grocery Run",    time: "7:00 PM", icon: "🛒", conflict: false, fix: "" },
  { id: 5, label: "Dinner Out",     time: "7:30 PM", icon: "🍽️", conflict: true,  fix: "Move to 5 PM or indoor option" },
];

const INSIGHTS = [
  { icon: "💧", body: "Stay hydrated — warm day, drink extra water" },
  { icon: "⏰", body: "Best productivity time is 2–5 PM" },
];

/* ── TOAST ── */
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
}

/* ── THEME ── */
function getWeatherTheme(code) {
  if (code === 0)   return { bg: "linear-gradient(135deg,#FFD700,#FFA500)", cardBg: "#FFF9E6", accent: "#F59E0B", emoji: "☀️" };
  if (code <= 2)    return { bg: "linear-gradient(135deg,#87CEEB,#B0C4DE)", cardBg: "#EFF6FF", accent: "#60A5FA", emoji: "⛅" };
  if (code === 3)   return { bg: "linear-gradient(135deg,#9CA3AF,#6B7280)", cardBg: "#F3F4F6", accent: "#9CA3AF", emoji: "☁️" };
  if (code <= 67)   return { bg: "linear-gradient(135deg,#4A7FA5,#2C5F7A)", cardBg: "#EFF6FF", accent: "#3B82F6", emoji: "🌧️" };
  if (code <= 77)   return { bg: "linear-gradient(135deg,#E0F2FE,#BAE6FD)", cardBg: "#F0F9FF", accent: "#7DD3FC", emoji: "❄️" };
  if (code <= 99)   return { bg: "linear-gradient(135deg,#1F2937,#374151)", cardBg: "#1F2937", accent: "#818CF8", emoji: "⛈️" };
  return { bg: "linear-gradient(135deg,#D1FAE5,#6EE7B7)", cardBg: "#F0FDF4", accent: "#10B981", emoji: "🌡️" };
}

function describeWeather(code) {
  if (code === 0)  return { text: "Clear sky",   emoji: "☀️" };
  if (code <= 2)   return { text: "Partly cloudy", emoji: "⛅" };
  if (code === 3)  return { text: "Overcast",    emoji: "☁️" };
  if (code <= 49)  return { text: "Foggy",       emoji: "🌫️" };
  if (code <= 67)  return { text: "Rainy",       emoji: "🌧️" };
  if (code <= 77)  return { text: "Snowy",       emoji: "❄️" };
  if (code <= 82)  return { text: "Showers",     emoji: "🌦️" };
  if (code <= 99)  return { text: "Thunderstorm",emoji: "⛈️" };
  return { text: "Unknown", emoji: "🌡️" };
}

/* ── WEATHER CARD ── */
function WeatherSummaryCard({ current, theme }) {
  const { text, emoji } = describeWeather(current.weathercode);
  return (
    <div className="wcard" style={{ background: theme.bg, boxShadow: `0 4px 24px ${theme.accent}44` }}>
      <div className="wcard-lbl">Weather Summary</div>
      <div className="wcard-main">
        <div className="wicon" style={{ fontSize: "3rem" }}>{emoji}</div>
        <div>
          <div className="wtemp">{Math.round(current.temperature_2m)}°C</div>
          <div className="wcond" style={{ color: theme.accent }}>{text}</div>
          <div className="wdesc">Feels like {Math.round(current.apparent_temperature ?? current.temperature_2m)}°</div>
        </div>
      </div>
      <div className="wbest">✅ Best time: 2 – 5 PM</div>
    </div>
  );
}

/* ── ML CLOTHING CARD ── */
const CLOTHING_EMOJI = {
  heavy_winter_coat_gloves_hat:      "🧤",
  winter_coat_scarf_gloves:          "🧣",
  warm_jacket_layers:                "🧥",
  light_jacket_or_sweater:           "👕",
  long_sleeves_light_layer:          "👔",
  t_shirt_comfortable:               "👕",
  light_breathable_clothing:         "🩱",
  very_light_clothing_stay_hydrated: "😎",
};

function MLClothingCard({ prediction, loading, error, theme }) {
  if (loading) {
    return (
      <div className="wcard" style={{ background: theme?.cardBg ?? "#fff", minHeight: 90 }}>
        <div className="wcard-lbl">👗 AI Clothing Recommendation</div>
        <div style={{ color: "#888", padding: "8px 0" }}>Analysing weather with ML model…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="wcard" style={{ background: "#FEF2F2" }}>
        <div className="wcard-lbl">👗 AI Clothing Recommendation</div>
        <div style={{ color: "#EF4444", fontSize: 13 }}>
          Backend not reachable. Make sure <code>uvicorn server:app</code> is running on port 8000.
        </div>
      </div>
    );
  }
  if (!prediction) return null;

  const emoji  = CLOTHING_EMOJI[prediction.clothing_recommendation] ?? "👕";
  const conf   = Math.round(prediction.clothing_confidence * 100);
  const uConf  = Math.round(prediction.umbrella_confidence * 100);

  return (
    <div className="wcard" style={{ background: theme?.cardBg ?? "#fff", borderTop: `4px solid ${theme?.accent ?? "#6366f1"}` }}>
      <div className="wcard-lbl" style={{ color: theme?.accent }}>👗 AI Clothing Recommendation</div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <span style={{ fontSize: "2.8rem" }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {clothingLabel(prediction.clothing_recommendation)}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            Model confidence: {conf}%
          </div>
        </div>
      </div>

      {/* Umbrella row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginTop: 12, padding: "8px 12px",
        background: prediction.umbrella_needed ? "#EFF6FF" : "#F0FDF4",
        borderRadius: 8
      }}>
        <span style={{ fontSize: "1.5rem" }}>{prediction.umbrella_needed ? "☔" : "🌤️"}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {prediction.umbrella_needed ? "Bring an umbrella!" : "No umbrella needed"}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>Confidence: {uConf}%</div>
        </div>
      </div>

      {/* Full advice text */}
      <div style={{ marginTop: 10, fontSize: 13, color: "#555", fontStyle: "italic" }}>
        💡 {prediction.recommendation_text}
      </div>
    </div>
  );
}

/* ── SMART SUGGESTIONS ── */
function SmartSuggestions({ mlPrediction }) {
  const suggestions = mlPrediction
    ? [
        { icon: CLOTHING_EMOJI[mlPrediction.clothing_recommendation] ?? "👕", text: clothingLabel(mlPrediction.clothing_recommendation), tag: "Now",    color: "violet" },
        { icon: mlPrediction.umbrella_needed ? "☔" : "🌤️",                    text: mlPrediction.umbrella_needed ? "Umbrella recommended" : "No umbrella needed", tag: "ML", color: "blue" },
        { icon: "🚶", text: "Perfect for a walk right now", tag: "Now",   color: "green" },
        { icon: "🌿", text: "Low pollen today",             tag: "All day", color: "amber" },
      ]
    : [
        { icon: "🚶", text: "Perfect for a walk right now",       tag: "Now",    color: "green"  },
        { icon: "☔", text: "Umbrella if out after 5 PM",         tag: "After 5",color: "blue"   },
        { icon: "🧥", text: "Light jacket for this evening",      tag: "6 PM+",  color: "violet" },
        { icon: "🌿", text: "Low pollen today",                   tag: "All day",color: "amber"  },
      ];

  return (
    <div>
      <div className="slbl">Smart Suggestions</div>
      <div className="sgrid">
        {suggestions.map((s, i) => (
          <div key={i} className={`scard ${s.color}`}>
            <div className="sicon">{s.icon}</div>
            <div className="stxt">{s.text}</div>
            <span className={`stag ${s.color}`}>{s.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── RESCHEDULE ITEM ── */
function RescheduleItem({ item, onResolve, toast }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const stop = (e, fn) => { e.stopPropagation(); fn(); };

  return (
    <div className={`titem ${item.conflict && !done ? "conflict" : ""} ${done ? "done" : ""}`} onClick={() => setOpen(!open)}>
      <div className="trow">
        <div className="temoji">{item.icon}</div>
        <div style={{ flex: 1 }}>
          <div className={`tname ${done ? "done" : ""}`}>{item.label}</div>
          <div className="ttime">⏳ {item.time}</div>
        </div>
        {item.conflict && !done && <div className="tbadge">⚠️ Conflict</div>}
      </div>
      {open && !done && (
        <div className="texpand">
          {item.fix && <div className="thint">💡 {item.fix}</div>}
          <div className="tbtns">
            {item.conflict && (
              <>
                <button className="tbtn move"  onClick={(e) => stop(e, () => { onResolve(item.id, "earlier");  setOpen(false); })}>Earlier</button>
                <button className="tbtn later" onClick={(e) => stop(e, () => { onResolve(item.id, "tomorrow"); setOpen(false); })}>Tomorrow</button>
              </>
            )}
            <button className="tbtn doneb" onClick={(e) => stop(e, () => { setDone(true); setOpen(false); toast("Done!"); })}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── RESCHEDULE PANEL ── */
function ReschedulePanel({ toast }) {
  const [items, setItems] = useState(RESCHEDULE_ITEMS);
  const resolve = (id, type) => {
    setItems((prev) => prev.map((i) => i.id !== id ? i : { ...i, conflict: false, time: type === "earlier" ? "3:30 PM" : "Tomorrow" }));
    toast(type === "earlier" ? "Rescheduled earlier" : "Moved to tomorrow");
  };
  const conflicts = items.filter((i) => i.conflict).length;

  return (
    <aside className="rpanel">
      <div className="rplbl">Reschedule {conflicts > 0 && <span className="badge">{conflicts} alerts</span>}</div>
      {items.map((i) => <RescheduleItem key={i.id} item={i} onResolve={resolve} toast={toast} />)}
      <button className="addbtn">＋ Add Plan</button>
      <hr className="idivider" />
      <div className="rplbl">Insights</div>
      {INSIGHTS.map((i, idx) => (
        <div key={idx} className="icard">
          <div className="iico">{i.icon}</div>
          <div className="itxt">{i.body}</div>
        </div>
      ))}
    </aside>
  );
}

/* ── APP ── */
export default function App() {
  const [toast,    setToast]    = useState(null);
  const [weather,  setWeather]  = useState(null);
  const [greeting, setGreeting] = useState("");
  const [theme,    setTheme]    = useState(null);
  const [mlPred,   setMlPred]   = useState(null);
  const [mlLoading,setMlLoading]= useState(true);
  const [mlError,  setMlError]  = useState(false);

  const LAT = 41.01;
  const LON = 28.97;

  useEffect(() => {
    // Fetch raw weather (for existing UI)
    getWeather(LAT, LON).then((data) => {
      setWeather(data);
      setTheme(getWeatherTheme(data.current.weathercode));
      const hour = new Date(data.current.time).getHours();
      if      (hour >=  5 && hour < 12) setGreeting("Good Morning");
      else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
      else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
      else                              setGreeting("Good Night");
    });

    // Fetch ML prediction separately (backend may be offline → graceful fallback)
    getMLPrediction(LAT, LON)
      .then((pred) => { setMlPred(pred); setMlLoading(false); })
      .catch(() => { setMlError(true); setMlLoading(false); });
  }, []);

  if (!weather || !theme) return <p>Loading weather…</p>;

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      <div className="app-shell">
        <main className="main-content">
          <div className="greet-row">
            <div>
              <div className="greet-name">
                {greeting} <span style={{ color: theme.accent }}>Fatima</span> 👋
              </div>
              <div className="greet-sub">Weather-based planning assistant</div>
            </div>
          </div>

          <WeatherSummaryCard current={weather.current} theme={theme} />

          {/* ── ML Clothing Recommendation Card ── */}
          <MLClothingCard
            prediction={mlPred}
            loading={mlLoading}
            error={mlError}
            theme={theme}
          />

          <SmartSuggestions mlPrediction={mlPred} />
        </main>

        <ReschedulePanel toast={setToast} />
      </div>
    </>
  );
}
