// src/App.jsx  — WeatherWise with ML clothing recommendations
import { useState, useEffect } from "react";
import "./App.css";
import {
  getWeather,
  getMLPredictionAll,
  clothingLabel,
  getForecastAtHour,
} from "./services/weather";
import { EMOJIS } from "./data/emojiMap";
/* ── DATA ── */
const RESCHEDULE_ITEMS = [
  {
    id: 1,
    label: "Evening Run",
    time: "6:00 PM",
    icon: "🏃",
    conflict: true,
    fix: "Daytime is more suitable for this activity",
  },
  {
    id: 2,
    label: "Walk the Dog",
    time: "5:00 PM",
    icon: "🐕",
    conflict: false,
    fix: "",
  },
  {
    id: 3,
    label: "Outdoor Lunch",
    time: "1:00 PM",
    icon: "🍱",
    conflict: false,
    fix: "",
  },
  {
    id: 4,
    label: "Grocery Run",
    time: "7:00 PM",
    icon: "🛒",
    conflict: false,
    fix: "",
  },
  {
    id: 5,
    label: "Dinner Out",
    time: "7:30 PM",
    icon: "🍽️",
    conflict: true,
    fix: "Avoid later — wind conditions worsen",
  },
];

const INSIGHTS = [
  { icon: "💧", body: "Stay hydrated — warm day, drink extra water" },
  { icon: "⏰", body: "Best productivity time is 2–5 PM" },
];

const formatDate = (timeString) => {
  const date = new Date(timeString);

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};
/* ── TOAST ── */
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);
  return <div className="toast">{msg}</div>;
}

/* ── THEME ── */
function getWeatherTheme(code) {
  if (code === 0)
    return {
      bg: "linear-gradient(135deg, #FFD700, #FFA500)",
      accent: "#F59E0B",
      text: "#1A0F00",
      condColor: "#F59E0B",
      type: "sunny",
    };

  if (code <= 2)
    return {
      bg: "linear-gradient(135deg, #87CEEB, #B0C4DE)",
      accent: "#60A5FA",
      text: "#1A0F00",
      condColor: "#5f87c7ff",
      type: "cloudy",
    };

  if (code === 3)
    return {
      bg: "linear-gradient(135deg, #9CA3AF, #6B7280)",
      accent: "#9CA3AF",
      text: "#FFFFFF",
      condColor: "#D1D5DB",
      type: "overcast",
    };

  if (code <= 67)
    return {
      bg: "linear-gradient(135deg, #4A7FA5, #2C5F7A)",
      accent: "#3B82F6",
      text: "#FFFFFF",
      condColor: "#60A5FA",
      type: "rainy",
    };

  if (code <= 77)
    return {
      bg: "linear-gradient(135deg, #E0F2FE, #BAE6FD)",
      accent: "#7DD3FC",
      text: "#1A0F00",
      condColor: "#38BDF8",
      type: "snowy",
    };

  if (code <= 99)
    return {
      bg: "linear-gradient(135deg, #1F2937, #374151)",
      accent: "#818CF8",
      text: "#FFFFFF",
      condColor: "#A78BFA",
      type: "storm",
    };

  return {
    bg: "linear-gradient(135deg, #D1FAE5, #6EE7B7)",
    accent: "#10B981",
    text: "#1A0F00",
    condColor: "#10B981",
    type: "default",
  };
}

function describeWeather(code) {
  if (code === 0) return { text: "Clear sky", emoji: "☀️" };
  if (code <= 2) return { text: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { text: "Overcast", emoji: "☁️" };
  if (code <= 49) return { text: "Foggy", emoji: "🌫️" };
  if (code <= 67) return { text: "Rainy", emoji: "🌧️" };
  if (code <= 77) return { text: "Snowy", emoji: "❄️" };
  if (code <= 82) return { text: "Showers", emoji: "🌦️" };
  if (code <= 99) return { text: "Thunderstorm", emoji: "⛈️" };
  return { text: "Unknown", emoji: "🌡️" };
}

/* ── WEATHER CARD ── */
function WeatherSummaryCard({ current, theme }) {
  const { text, emoji } = describeWeather(current.weathercode);
  return (
    <div
      className="wcard"
      style={{
        background: theme.bg,
        boxShadow: `0 4px 24px ${theme.accent}44`,
      }}
    >
      <div className="wcard-title">Weather Summary</div>
      <div className="wcard-main">
        <div className="wicon" style={{ fontSize: "7rem" }}>
          {emoji}
        </div>
        <div>
          <div className="wtemp">{Math.round(current.temperature_2m)}°C</div>
          <div
            className="wcond glass"
            style={{
              background: `linear-gradient(90deg, ${theme.accent}, ${theme.condColor})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {text}
          </div>
          <div className="wdesc">
            Feels like{" "}
            {Math.round(current.apparent_temperature ?? current.temperature_2m)}
            °
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── ML CLOTHING CARD ── */
const CLOTHING_EMOJI = {
  heavy_winter_coat_gloves_hat: "🧤",
  winter_coat_scarf_gloves: "🧣",
  warm_jacket_layers: "🧥",
  light_jacket_or_sweater: "👕",
  long_sleeves_light_layer: "👔",
  t_shirt_comfortable: "👕",
  light_breathable_clothing: "🩱",
  very_light_clothing_stay_hydrated: "😎",
};

function MLClothingCard({ prediction, loading, error, theme }) {
  if (loading) {
    return (
      <div
        className="wcard"
        style={{ background: theme?.cardBg ?? "#fff", minHeight: 90 }}
      >
        <div className="wcard-lbl">👗 AI Clothing Recommendation</div>
        <div style={{ color: "#888", padding: "8px 0" }}>
          Analysing weather with ML model…
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="wcard" style={{ background: "#FEF2F2" }}>
        <div className="wcard-lbl">👗 AI Clothing Recommendation</div>
        <div style={{ color: "#EF4444", fontSize: 13 }}>
          Backend not reachable. Make sure <code>uvicorn server:app</code> is
          running on port 8000.
        </div>
      </div>
    );
  }
  if (!prediction) return null;

  const emoji = CLOTHING_EMOJI[prediction.clothing_recommendation] ?? "👕";
  const conf = Math.round(prediction.clothing_confidence * 100);
  const uConf = Math.round(prediction.umbrella_confidence * 100);

  return (
    <div
      className="wcard"
      style={{
        background: theme?.cardBg ?? "#ffffff76",
        borderTop: `4px solid ${theme?.accent ?? "#6366f1"}`,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}
      >
        <span style={{ fontSize: "2.8rem" }}>{emoji}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {clothingLabel(prediction.clothing_recommendation)}
          </div>
          {/* <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
            Model confidence: {conf}%
          </div> */}
        </div>
      </div>

      {/* Umbrella row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          padding: "8px 12px",
          background: prediction.umbrella_needed ? "#eff6ffa0" : "#F0FDF4",
          borderRadius: 8,
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>
          {prediction.umbrella_needed ? "☔" : "🌤️"}
        </span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {prediction.umbrella_needed
              ? "Bring an umbrella!"
              : "No umbrella needed"}
          </div>
          {/* <div style={{ fontSize: 11, color: "#888" }}>
            Confidence: {uConf}%
          </div> */}
        </div>
      </div>

      {/* Full advice text */}
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          color: "#555",
          fontStyle: "italic",
        }}
      >
        💡 {prediction.recommendation_text}
      </div>
    </div>
  );
}

function formatHour(hour) {
  const period = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${period}`;
}

const hour = new Date().getHours();

let nowTag;
let laterTag;

if (hour < 12) {
  nowTag = "This morning";
  laterTag = "Later today";
} else if (hour < 18) {
  nowTag = "This afternoon";
  laterTag = "This evening";
} else {
  nowTag = "This evening";
  laterTag = "Tonight";
}

if (hour < 12) {
  nowTag = "This morning";
  laterTag = "Later today";
} else if (hour < 18) {
  nowTag = "This afternoon";
  laterTag = "This evening";
} else {
  nowTag = "This evening";
  laterTag = "Tonight";
}

function getExtraAdvice(weather, mlPrediction) {
  const temp = weather?.current?.temperature_2m ?? 0;
  const uv = weather?.current?.uv_index ?? 0;

  // ☔ Rain
  if (mlPrediction?.umbrella_needed) {
    return {
      icon: "☔",
      text: "Take an umbrella",
      tag: "Now",
    };
  }

  // ☀️ Strong sun → sunscreen first
  if (uv >= 6) {
    return {
      icon: "🧴",
      text: "Use sunscreen",
      tag: "Now",
    };
  }

  // 😎 Moderate sun → sunglasses
  if (uv >= 3) {
    return {
      icon: "🕶️",
      text: "Sunglasses will help",
      tag: "Now",
    };
  }

  // 🔥 Hot
  if (temp >= 28) {
    return {
      icon: "💧",
      text: "Stay hydrated",
      tag: "Now",
    };
  }

  // 🌤️ Default
  return {
    icon: "🌤️",
    text: "No umbrella needed",
    tag: "Now",
  };
}
/* ── SMART SUGGESTIONS ── */
function SmartSuggestions({ mlPrediction, weather }) {
  // ✅ IF ML EXISTS
  if (mlPrediction && mlPrediction.activity_suggestions?.length > 0) {
    const top1 = mlPrediction.activity_suggestions[0];
    const top2 = mlPrediction.activity_suggestions[1];
    const now = new Date();
    const currentHour = now.getHours();
    const extra = getExtraAdvice(weather, mlPrediction);

    const nextHour = (currentHour + 2) % 24;
    const laterHour = (currentHour + 4) % 24;

    const suggestions = [
      {
        icon: CLOTHING_EMOJI[mlPrediction.clothing_recommendation] ?? "👕",
        text: clothingLabel(mlPrediction.clothing_recommendation),
        tag: "Now",
        color: "violet",
      },
      {
        icon: extra.icon,
        text: extra.text,
        tag: "Today",
        color: "blue",
      },
      {
        icon: top1.emoji,
        text: `${top1.label}`,
        tag: "Best now",
        color: "green",
      },
      {
        icon: top2?.emoji,
        text: `${top2.label}`,
        tag: laterTag,
        color: "amber",
      },
    ];

    return (
      <div>
        <div className="smart-title">Smart Suggestions</div>
        <div className="sgrid">
          {suggestions.map((s, i) => (
            <div key={i} className={`scard ${s.color}`}>
              <div className="sicon">{s.icon}</div>
              <div className="stxt">{s.text}</div>
              {i === 2 && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                  {mlPrediction.activity_suggestions.map((a, ai) => (
                    <div key={ai} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{a.emoji}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{a.label}</span>
                    </div>
                  ))}
                </div>
              )}
              <span className={`stag ${s.color}`}>{s.tag}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ✅ FALLBACK (VERY IMPORTANT)
  const fallback = [
    {
      icon: "🚶",
      text: "Perfect for a walk right now",
      tag: "Now",
      color: "green",
    },
    {
      icon: "☔",
      text: "Umbrella if out after 5 PM",
      tag: "After 5",
      color: "blue",
    },
    {
      icon: "🧥",
      text: "Light jacket for this evening",
      tag: "6 PM+",
      color: "violet",
    },
    { icon: "🌿", text: "Low pollen today", tag: "All day", color: "amber" },
  ];

  return (
    <div>
      <div className="smart-title">Smart Suggestions</div>
      <div className="sgrid">
        {fallback.map((s, i) => (
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
function RescheduleItem({ item, onResolve, onDelete, toast }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTime, setNewTime] = useState("");
  const stop = (e, fn) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={`titem ${item.conflict && !done ? "conflict" : ""} ${done ? "done" : ""}`}
      onClick={() => setOpen(true)}
    >
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
                <button
                  className="tbtn later"
                  onClick={(e) =>
                    stop(e, () => {
                      setEditing(true);
                    })
                  }
                >
                  Reschedule
                </button>
                {editing && (
                  <div
                    style={{ marginTop: 10 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="time"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      style={{
                        padding: "6px",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                        marginRight: "6px",
                      }}
                    />

                    <button
                      className="tbtn move"
                      onClick={(e) =>
                        stop(e, () => {
                          if (!newTime) return;

                          onResolve(item.id, newTime);
                          setEditing(false);
                        })
                      }
                    >
                      Save
                    </button>
                  </div>
                )}
              </>
            )}
            <button
              className="tbtn doneb"
              onClick={(e) =>
                stop(e, () => {
                  setDone(true);
                  setOpen(false);
                  toast("Done!");
                })
              }
            >
              Done
            </button>

            <button
              className="tbtn delete"
              onClick={(e) =>
                stop(e, () => {
                  onDelete(item.id);
                })
              }
            >
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── RESCHEDULE PANEL ── */
function ReschedulePanel({ toast }) {
  const [items, setItems] = useState(RESCHEDULE_ITEMS);
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("outdoor");

  const formatTime = (time) => {
    const [h, m] = time.split(":");
    const hour = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour}:${m} ${ampm}`;
  };

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast("Task deleted");
  };

  const resolve = (id, newTime) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id !== id
          ? i
          : {
              ...i,
              conflict: false,
              time: formatTime(newTime),
            },
      ),
    );

    toast("Rescheduled successfully");
  };
  const addPlan = () => {
    if (!newLabel || !newTime) {
      toast("Please enter activity and time");
      return;
    }

    const newItem = {
      id: Date.now(),
      label: newLabel,
      time: newTime,
      icon: EMOJIS[newLabel.toLowerCase()] || "✨",
      type,
      conflict: false,
      fix: "",
    };

    setItems((prev) => [...prev, newItem]);

    setNewLabel("");
    setNewTime("");
    setType("outdoor");
    setShowAdd(false);
  };
  const conflicts = items.filter((i) => i.conflict).length;

  return (
    <aside className="rpanel">
      <div className="task-title">Reschedule alerts</div>

      {items.map((i) => (
        <RescheduleItem
          key={i.id}
          item={i}
          onResolve={resolve}
          onDelete={deleteItem}
          toast={toast}
        />
      ))}

      {showForm ? (
        <div className="inline-add">
          <input
            type="text"
            placeholder="Activity"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />

          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              className={`type-btn ${type === "indoor" ? "active" : ""}`}
              onClick={() => setType("indoor")}
            >
              🏠 Indoor
            </button>

            <button
              className={`type-btn ${type === "outdoor" ? "active" : ""}`}
              onClick={() => setType("outdoor")}
            >
              🌳 Outdoor
            </button>
          </div>

          <button
            className="confirm-btn"
            onClick={() => {
              addPlan();
              setShowForm(false);
            }}
          >
            ✔
          </button>
        </div>
      ) : (
        <button className="addbtn" onClick={() => setShowForm(true)}>
          ＋ Add Plan
        </button>
      )}
      <hr className="idivider" />

      <div className="insight-title">Insights</div>

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
  const [toast, setToast] = useState(null);
  const [weather, setWeather] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [theme, setTheme] = useState(null);
  const [mlPred, setMlPred] = useState(null);
  const [mlLoading, setMlLoading] = useState(true);
  const [mlError, setMlError] = useState(false);

  const [lat, setLat] = useState(41.01);
  const [lon, setLon] = useState(28.97);
  const [cityInput, setCityInput] = useState("");
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState("");

  const searchCity = async () => {
    if (!cityInput.trim()) return;
    setCitySearching(true);
    setCityError("");
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput)}&count=1`
      );
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setCityError("City not found. Try another name.");
        setCitySearching(false);
        return;
      }
      const { latitude, longitude } = data.results[0];
      setLat(latitude);
      setLon(longitude);
      setCityInput("");
    } catch {
      setCityError("Search failed. Check your connection.");
    }
    setCitySearching(false);
  };

  useEffect(() => {
    setWeather(null);
    setTheme(null);
    setMlPred(null);
    setMlLoading(true);
    setMlError(false);

    // Fetch raw weather (for existing UI)
    getWeather(lat, lon).then((data) => {
      setWeather(data);
      setTheme(getWeatherTheme(data.current.weathercode));
      const hour = new Date(data.current.time).getHours();
      if (hour >= 5 && hour < 12) setGreeting("Good Morning");
      else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
      else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
      else setGreeting("Good Night");
    });

    // Fetch ML prediction separately (backend may be offline → graceful fallback)
    getMLPredictionAll(lat, lon)
      .then((pred) => {
        setMlPred(pred);
        setMlLoading(false);
      })
      .catch((err) => {
        console.error("ML ERROR:", err);
        setMlError(true);
        setMlLoading(false);
      });
  }, [lat, lon]);

  if (!weather || !theme) return <p>Loading weather…</p>;

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
              </div>
            </div>
            <div className="city-search">
              <div className="city-search-row">
                <input
                  className="city-input"
                  type="text"
                  placeholder="Search city…"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchCity()}
                />
                <button
                  className="city-btn"
                  onClick={searchCity}
                  disabled={citySearching}
                >
                  {citySearching ? "…" : "🔍"}
                </button>
              </div>
              {cityError && <div className="city-error">{cityError}</div>}
            </div>
          </div>

          <WeatherSummaryCard current={weather.current} theme={theme} />

          <SmartSuggestions mlPrediction={mlPred} weather={weather} />
        </main>

        <ReschedulePanel toast={setToast} />
      </div>
    </>
  );
}

