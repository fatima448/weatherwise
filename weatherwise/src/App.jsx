import { useState, useEffect } from "react";
import "./App.css";

/* ── DATA ── */
const W = {
  city: "Istanbul",
  temp: 24,
  feels: 22,
  rain: 10,
  wind: "Light",
  uv: 6,
  humidity: 60,
  headline: "Warm & Sunny",
  bestTime: "2 – 5 PM",
};

const RESCHEDULE_ITEMS = [
  { id: 1, label: "Evening Run", time: "6:00 PM", icon: "🏃", conflict: true, fix: "Move to 3:30 PM — clear skies" },
  { id: 2, label: "Walk the Dog", time: "5:00 PM", icon: "🐕", conflict: false, fix: "" },
  { id: 3, label: "Outdoor Lunch", time: "1:00 PM", icon: "🍱", conflict: false, fix: "" },
  { id: 4, label: "Grocery Run", time: "7:00 PM", icon: "🛒", conflict: false, fix: "" },
  { id: 5, label: "Dinner Out", time: "7:30 PM", icon: "🍽️", conflict: true, fix: "Move to 5 PM or indoor option" },
];

const SUGGESTIONS = [
  { icon: "🚶", text: "Perfect for a walk right now", tag: "Now", color: "green" },
  { icon: "☔", text: "Umbrella if out after 5 PM", tag: "After 5", color: "blue" },
  { icon: "🧥", text: "Light jacket for this evening", tag: "6 PM+", color: "violet" },
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
function WeatherSummaryCard() {
  return (
    <div className="wcard">
      <div className="wcard-lbl">Weather Summary</div>

      <div className="wcard-main">
        <div className="wicon">☀️</div>
        <div>
          <div className="wtemp">{W.temp}°C</div>
          <div className="wcond">{W.headline}</div>
          <div className="wdesc">Feels like {W.feels}°</div>
        </div>
      </div>

      <div className="wbest">✅ Best time: {W.bestTime}</div>
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
            }
      )
    );

    toast(type === "earlier" ? "Rescheduled earlier" : "Moved to tomorrow");
  };

  const conflicts = items.filter((i) => i.conflict).length;

  return (
    <aside className="rpanel">
      <div className="rplbl">
        Reschedule
        {conflicts > 0 && (
          <span className="badge">{conflicts} alerts</span>
        )}
      </div>

      {items.map((i) => (
        <RescheduleItem
          key={i.id}
          item={i}
          onResolve={resolve}
          toast={toast}
        />
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

/* ── APP ── */
export default function App() {
  const [toast, setToast] = useState(null);

  return (
    <>
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

      <div className="app-shell">
        <main className="main-content">
          <div className="greet-row">
            <div>
              <div className="greet-name">
                Good Morning <span>Fatima</span> 👋
              </div>
              <div className="greet-sub">Weather-based planning assistant</div>
            </div>
          </div>

          <WeatherSummaryCard />
          <SmartSuggestions />
        </main>

        <ReschedulePanel toast={setToast} />
      </div>
    </>
  );
}