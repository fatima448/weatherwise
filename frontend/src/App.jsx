import { useState, useEffect } from "react";
import "./App.css";
import { getWeather } from "./services/weather";
import { EMOJIS } from "./data/emojiMap";

/* ── DATA ── */

const RESCHEDULE_ITEMS = [
  {
    id: 1,
    label: "Evening Run",
    time: "6:00 PM",
    icon: "🏃",
    conflict: true,
    fix: "Move to 3:30 PM — clear skies",
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
    fix: "Move to 5 PM or indoor option",
  },
];

const SUGGESTIONS = [
  {
    type: "walk",
    text: "Perfect for a walk right now",
    tag: "Now",
    color: "green",
  },
  {
    type: "umbrella",
    text: "Umbrella if out after 5 PM",
    tag: "After 5",
    color: "blue",
  },
  {
    type: "jacket",
    text: "Light jacket for this evening",
    tag: "6 PM+",
    color: "violet",
  },
  {
    type: "pollen",
    text: "Low pollen today",
    tag: "All day",
    color: "amber",
  },
];

const INSIGHTS = [
  { icon: "💧", body: "Stay hydrated — warm day, drink extra water" },
  { icon: "⏰", body: "Best productivity time is 2–5 PM" },
];

/* ── TOAST ── */
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, []);

  return <div className="toast">{msg}</div>;
}

/* ── WEATHER ── */
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
function isNight(timeStr) {
  const hour = new Date(timeStr).getHours();
  return hour < 6 || hour >= 18; // night from 6PM → 6AM
}

function describeWeather(code, timeStr) {
  const night = isNight(timeStr);

  if (code === 0)
    return {
      text: "Clear sky",
      emoji: night ? "🌙" : "☀️",
    };

  if (code <= 2)
    return {
      text: "Partly cloudy",
      emoji: night ? "☁️" : "⛅",
    };

  if (code === 3)
    return {
      text: "Overcast",
      emoji: "☁️",
    };

  if (code <= 49)
    return {
      text: "Foggy",
      emoji: "🌫️",
    };

  if (code <= 67)
    return {
      text: "Rainy",
      emoji: night ? "🌧️" : "🌧️",
    };

  if (code <= 77)
    return {
      text: "Snowy",
      emoji: night ? "❄️" : "❄️",
    };

  if (code <= 82)
    return {
      text: "Showers",
      emoji: night ? "🌧️" : "🌦️",
    };

  if (code <= 99)
    return {
      text: "Thunderstorm",
      emoji: "⛈️",
    };

  return {
    text: "Unknown",
    emoji: "🌡️",
  };
}

function WeatherSummaryCard({ current, theme }) {
  const { text, emoji } = describeWeather(current.weathercode, current.time);

  return (
    <div
      className={`wcard ${theme.type}`}
      style={{
        background: theme.bg,
        color: theme.text,
      }}
    >
      <div className="wcard-title">Weather Summary</div>
      <div className="wcard-main">
        <div className="wicon">{emoji}</div>
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
/* ── SUGGESTIONS ── */
function SmartSuggestions() {
  return (
    <div>
      <div className="smart-title">Smart Suggestions</div>

      <div className="sgrid">
        {SUGGESTIONS.map((s, i) => (
          <div key={i} className={`scard ${s.color}`}>
            <div className="sicon">{EMOJIS[s.type] || EMOJIS.default}</div>
            <div className="stxt">{s.text}</div>
            <span className={`stag ${s.color}`}>{s.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ITEM ── */
function RescheduleItem({ item, onResolve, onDelete, toast }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const stop = (e, fn) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className={`titem ${item.conflict && !done ? "conflict" : ""} ${done ? "done" : ""}`}
      onClick={() => setOpen(!open)}
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
                  className="tbtn move"
                  onClick={(e) =>
                    stop(e, () => {
                      onResolve(item.id, "earlier");
                      setOpen(false);
                    })
                  }
                >
                  Earlier
                </button>

                <button
                  className="tbtn later"
                  onClick={(e) =>
                    stop(e, () => {
                      onResolve(item.id, "tomorrow");
                      setOpen(false);
                    })
                  }
                >
                  Tomorrow
                </button>
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
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PANEL ── */
function convertToMinutes(timeStr) {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function ReschedulePanel({ toast }) {
  const [items, setItems] = useState(RESCHEDULE_ITEMS);
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState("");
  const [showForm, setShowForm] = useState(false);

  const resolve = (id, type) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id !== id
          ? i
          : {
              ...i,
              conflict: false,
              time: type === "earlier" ? "3:30 PM" : "Tomorrow",
            },
      ),
    );

    toast(type === "earlier" ? "Rescheduled earlier" : "Moved to tomorrow");
  };
  const deleteItem = (id) => {
    if (!confirm("Delete this activity?")) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    toast("Deleted");
  };

  const addPlan = () => {
    if (!newLabel || !newTime) {
      toast("Please enter activity and time");
      return;
    }
    const conflict = hasConflict(newTime, items);

    const newItem = {
      id: Date.now(),
      label: newLabel,
      time: newTime,
      icon: EMOJIS[newLabel.toLowerCase()] || "✨",
      conflict: conflict,
      fix: conflict ? "This overlaps with another plan" : "",
    };

    setItems((prev) => [...prev, newItem]);

    setNewLabel("");
    setNewTime("");
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
function hasConflict(newTime, items) {
  const newStart = convertToMinutes(newTime);
  const newEnd = newStart + 60; // assume 1-hour activity

  return items.some((item) => {
    const itemStart = convertToMinutes(item.time);
    const itemEnd = itemStart + 60;

    return newStart < itemEnd && newEnd > itemStart;
  });
}
function getAfternoonRisk(hourlyData) {
  // hours 17-21 = evening
  const eveningRain = hourlyData.precipitation_probability
    .slice(17, 21)
    .some((prob) => prob > 40);

  return eveningRain ? "Bring an umbrella if going out tonight!" : null;
}

/* ── APP ── */
export default function App() {
  const [toast, setToast] = useState(null);
  const [weather, setWeather] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    getWeather().then((data) => {
      setWeather(data);
      setTheme(getWeatherTheme(data.current.weathercode));

      const timeStr = data.current.time;
      const hour = new Date(timeStr).getHours();

      if (hour >= 5 && hour < 12) setGreeting("Good Morning");
      else if (hour >= 12 && hour < 17) setGreeting("Good Afternoon");
      else if (hour >= 17 && hour < 21) setGreeting("Good Evening");
      else setGreeting("Good Night");
    });
  }, []);

  if (!weather || !theme) return <p>Loading weather...</p>;

  const current = weather.current;

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      <div className="app-shell">
        <main className="main-content">
          <div className="greet-row">
            <div>
              <div className="greet-name">{greeting} 👋</div>
            </div>
          </div>

          <WeatherSummaryCard current={current} theme={theme} />
          <SmartSuggestions />
        </main>

        <ReschedulePanel toast={setToast} />
      </div>
    </>
  );
}
