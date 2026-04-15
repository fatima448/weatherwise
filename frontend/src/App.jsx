import { useState, useEffect } from "react";
import "./App.css";
import { getWeather } from "./services/weather";

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
  if (code === 0) return {
    bg: "linear-gradient(135deg, #FFD700, #FFA500)",  // sunny yellow
    cardBg: "#FFF9E6",
    accent: "#F59E0B",
    emoji: "☀️"
  };
  if (code <= 2) return {
    bg: "linear-gradient(135deg, #87CEEB, #B0C4DE)",  // partly cloudy blue
    cardBg: "#EFF6FF",
    accent: "#60A5FA",
    emoji: "⛅"
  };
  if (code === 3) return {
    bg: "linear-gradient(135deg, #9CA3AF, #6B7280)",  // overcast grey
    cardBg: "#F3F4F6",
    accent: "#9CA3AF",
    emoji: "☁️"
  };
  if (code <= 67) return {
    bg: "linear-gradient(135deg, #4A7FA5, #2C5F7A)",  // rainy dark blue
    cardBg: "#EFF6FF",
    accent: "#3B82F6",
    emoji: "🌧️"
  };
  if (code <= 77) return {
    bg: "linear-gradient(135deg, #E0F2FE, #BAE6FD)",  // snowy light
    cardBg: "#F0F9FF",
    accent: "#7DD3FC",
    emoji: "❄️"
  };
  if (code <= 99) return {
    bg: "linear-gradient(135deg, #1F2937, #374151)",  // stormy dark
    cardBg: "#1F2937",
    accent: "#818CF8",
    emoji: "⛈️"
  };
  return {
    bg: "linear-gradient(135deg, #D1FAE5, #6EE7B7)",
    cardBg: "#F0FDF4",
    accent: "#10B981",
    emoji: "🌡️"
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
/* ── SUGGESTIONS ── */
function SmartSuggestions() {
  return (
    <div>
      <div className="slbl">Smart Suggestions</div>

      <div className="sgrid">
        {SUGGESTIONS.map((s, i) => (
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

/* ── ITEM ── */
function RescheduleItem({ item, onResolve, toast }) {
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
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PANEL ── */
function ReschedulePanel({ toast }) {
  const [items, setItems] = useState(RESCHEDULE_ITEMS);

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

  const conflicts = items.filter((i) => i.conflict).length;

  return (
    <aside className="rpanel">
      <div className="rplbl">
        Reschedule
        {conflicts > 0 && <span className="badge">{conflicts} alerts</span>}
      </div>

      {items.map((i) => (
        <RescheduleItem key={i.id} item={i} onResolve={resolve} toast={toast} />
      ))}

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
              <div className="greet-name">
                {greeting} <span style={{ color: theme.accent }}>Fatima</span> 👋
              </div>
              <div className="greet-sub">Weather-based planning assistant</div>
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
