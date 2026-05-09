// src/components/ReschedulePanel.jsx — FIXED


import { useState, useEffect, useRef, useCallback } from "react";
import { getForecastAtHour } from "../services/weather";
import { formatTime } from "../utils/weatherHelpers";
import { EMOJIS } from "../data/emojiMap";
// import WeatherChat from "./WeatherChat";

// ── Gemini API call with exact required prompt ──────────────────────────────
async function classifyWithGemini(activity, hour, forecast) {
  const prompt = `You are an assistant that evaluates whether an activity conflicts with weather.
Classify the activity as indoor or outdoor, then decide if the weather creates a conflict.
Return ONLY JSON:
{ "type": "indoor" | "outdoor", "conflict": true | false, "reason": "short explanation", "suggestion": "optional advice" }

Activity: "${activity}"
Hour: ${hour}:00
Weather: ${JSON.stringify(forecast)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  return JSON.parse(cleaned);
}

// ── Fallback rule-based check ───────────────────────────────────────────────
function fallbackConflict(forecast) {
  if (!forecast) return { conflict: false, conflictReason: null, fix: "" };
  if (
    forecast.precipitation_probability > 50 ||
    forecast.weathercode >= 95 ||
    forecast.windspeed > 40
  ) {
    return {
      conflict: true,
      conflictReason: "Weather conditions may not be suitable",
      fix: "Consider rescheduling",
    };
  }
  return { conflict: false, conflictReason: null, fix: "" };
}

// ── Evaluate a single task against weather ─────────────────────────────────
// Stores results in weatherConflict/weatherReason/weatherFix so that
// applyOverlapConflicts can distinguish weather conflicts from overlap conflicts.
async function evaluateTask(task, lat, lon) {
  let weatherConflict = false, weatherReason = null, weatherFix = "";

  try {
    const forecast = await getForecastAtHour(lat, lon, task.hour);
    try {
      const result  = await classifyWithGemini(task.label, task.hour, forecast);
      weatherConflict = result.conflict;
      weatherReason   = result.reason || null;
      weatherFix      = result.suggestion || "";
    } catch {
      const fb      = fallbackConflict(forecast);
      weatherConflict = fb.conflict;
      weatherReason   = fb.conflictReason;
      weatherFix      = fb.fix;
    }
  } catch {
    // Forecast fetch failed — keep existing weather state
    weatherConflict = task.weatherConflict ?? false;
    weatherReason   = task.weatherReason ?? null;
    weatherFix      = task.weatherFix ?? "";
  }

  return {
    ...task,
    weatherConflict,
    weatherReason,
    weatherFix,
    conflict:       weatherConflict,
    conflictReason: weatherReason,
    fix:            weatherFix,
  };
}

const OVERLAP_REASON = "Overlaps with another task at the same time";


function applyOverlapConflicts(items) {
  const byHour = {};
  items.forEach((item) => {
    if (!byHour[item.hour]) byHour[item.hour] = [];
    byHour[item.hour].push(item.id);
  });

  return items.map((item) => {
    const hasOverlap = byHour[item.hour].filter((id) => id !== item.id).length > 0;

    if (hasOverlap) {
      // Preserve weather conflict reason if it exists, otherwise use overlap reason
      const reason = item.weatherReason || item.conflictReason !== OVERLAP_REASON
        ? (item.weatherReason ?? (item.conflictReason !== OVERLAP_REASON ? item.conflictReason : null))
        : null;
      return {
        ...item,
        conflict: true,
        conflictReason: reason || OVERLAP_REASON,
        fix: item.weatherFix || item.fix || "Reschedule one of the overlapping tasks",
        _hasOverlap: true,
      };
    }

    // No overlap — restore to weather-only state
    return {
      ...item,
      conflict: item.weatherConflict ?? item.conflict,
      conflictReason: item.weatherReason ?? (item._hasOverlap ? null : item.conflictReason),
      fix: item.weatherFix ?? (item._hasOverlap ? "" : item.fix),
      _hasOverlap: false,
    };
  });
}

const DEFAULT_TASKS = [
  { id: 1, label: "Evening Run",   time: "6:00 PM", hour: 18, icon: "🏃", conflict: false, conflictReason: null, fix: "" },
  { id: 2, label: "Walk the Dog",  time: "5:00 PM", hour: 17, icon: "🐕", conflict: false, conflictReason: null, fix: "" },
  { id: 3, label: "Outdoor Lunch", time: "1:00 PM", hour: 13, icon: "🍱", conflict: false, conflictReason: null, fix: "" },
  { id: 4, label: "Grocery Run",   time: "7:00 PM", hour: 19, icon: "🛒", conflict: false, conflictReason: null, fix: "" },
  { id: 5, label: "Dinner Out",    time: "7:30 PM", hour: 19, icon: "🍽️", conflict: false, conflictReason: null, fix: "" },
];

/* ── Single task item ── */
function RescheduleItem({ item, onResolve, onDelete, toast }) {
  const [open, setOpen]       = useState(false);
  const [done, setDone]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [newTime, setNewTime] = useState("");
  const stop = (e, fn) => { e.stopPropagation(); fn(); };

  return (
    <div
      className={`titem ${item.conflict && !done ? "conflict" : ""} ${done ? "done" : ""}`}
      onClick={() => setOpen((o) => !o)}
      style={item.conflict && !done ? {
        border: "1.5px solid rgba(248, 113, 113, 0.6)",
        boxShadow: "0 0 0 3px rgba(248, 113, 113, 0.12), 0 2px 12px rgba(248, 113, 113, 0.15)",
        animation: "conflictPulse 2.5s ease-in-out infinite",
      } : {}}
    >
      <div className="trow">
        <div className={`temoji ${item.conflict && !done ? "conflict" : ""}`}>{item.icon}</div>
        <div style={{ flex: 1 }}>
          <div className={`tname ${done ? "done" : ""}`}>{item.label}</div>
          <div className="ttime">⏳ {item.time}</div>
          {item.conflict && !done && item.conflictReason && (
            <div style={{ fontSize: 11, color: "#f87171", marginTop: 2, fontStyle: "italic" }}>
              ⚠️ {item.conflictReason}
            </div>
          )}
        </div>
        {item.conflict && !done && (
          <div className="tbadge" style={{
            background: "rgba(248,113,113,0.18)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.35)",
            fontWeight: 800,
            fontSize: 11,
          }}>
            ⚠️ Conflict
          </div>
        )}
      </div>

      {open && !done && (
        <div className="texpand">
          {item.fix && <div className="thint">💡 {item.fix}</div>}
          <div className="tbtns">
            {item.conflict && (
              <>
                <button className="tbtn later" onClick={(e) => stop(e, () => setEditing(true))}>
                  Reschedule
                </button>
                {editing && (
                  <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="time" value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      style={{ padding: "6px", borderRadius: "8px", border: "1px solid #ccc", marginRight: "6px" }}
                    />
                    <button className="tbtn move" onClick={(e) => stop(e, () => {
                      if (!newTime) return;
                      onResolve(item.id, newTime);
                      setEditing(false);
                    })}>Save</button>
                  </div>
                )}
              </>
            )}
            <button className="tbtn doneb" onClick={(e) => stop(e, () => { setDone(true); setOpen(false); toast("Done!"); })}>
              Done
            </button>
            <button className="tbtn delete" onClick={(e) => stop(e, () => onDelete(item.id))}>
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Panel ── */
export default function ReschedulePanel({ toast, lat, lon, weather, onTasksChange }) {
  const [items, setItems]       = useState(DEFAULT_TASKS);
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding]     = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Track which task IDs were user-added (not defaults) so we can distinguish if needed
  const userAddedIds = useRef(new Set());

  const isSyncMounted = useRef(false);

  // ── Re-evaluate ALL tasks when lat/lon/weather changes ──────────────────
  useEffect(() => {
    if (lat === null || lon === null || !weather) return;

    let cancelled = false;
    setEvaluating(true);

    (async () => {
      try {
        // Evaluate all tasks in parallel
        const evaluated = await Promise.all(
          items.map((task) => evaluateTask(task, lat, lon))
        );
        if (cancelled) return;

        // Apply same-hour overlap detection on top
        const withOverlaps = applyOverlapConflicts(evaluated);
        setItems(withOverlaps);
      } catch (err) {
        console.warn("Bulk task evaluation failed", err);
      } finally {
        if (!cancelled) setEvaluating(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, weather]);

  // ── Sync tasks up to App.jsx so HourlyTimeline can see them ─────────────
  // Skip the very first call (mount with default tasks) to prevent
  // a layout reflow cascade that auto-scrolls the page on mobile.
  useEffect(() => {
    if (!isSyncMounted.current) {
      isSyncMounted.current = true;
      return;
    }
    if (onTasksChange) onTasksChange(items);
  }, [items, onTasksChange]);

  const deleteItem = (id) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      return applyOverlapConflicts(next);
    });
    userAddedIds.current.delete(id);
    toast("Task deleted");
  };

  const resolve = (id, t) => {
    const [h] = t.split(":").map(Number);
    setItems((prev) => {
      const updated = prev.map((i) =>
        i.id !== id ? i : {
          ...i,
          hour: h,
          time: formatTime(t),
          // Clear all conflict state; weather re-eval will restore if still bad
          weatherConflict: false,
          weatherReason:   null,
          weatherFix:      "",
          conflict:        false,
          conflictReason:  null,
          fix:             "",
          _hasOverlap:     false,
        }
      );
      // Re-check overlaps after reschedule
      return applyOverlapConflicts(updated);
    });
    toast("Rescheduled successfully");

    // Re-evaluate the rescheduled task against weather at the new hour
    if (lat !== null && lon !== null) {
      const task = items.find((i) => i.id === id);
      if (task) {
        evaluateTask({ ...task, hour: h, time: formatTime(t) }, lat, lon).then((evaluated) => {
          setItems((prev) => {
            const updated = prev.map((i) => i.id !== id ? i : evaluated);
            return applyOverlapConflicts(updated);
          });
        });
      }
    }
  };

  // ── Add new task — Gemini classifies it ─────────────────────────────────
  const addPlan = async () => {
    if (!newLabel || !newTime) { toast("Please enter activity and time"); return; }
    setAdding(true);

    const [h] = newTime.split(":").map(Number);
    let conflict = false, conflictReason = null, fix = "";
    let icon = EMOJIS[newLabel.toLowerCase()] || "🌳";

    try {
      const forecast = await getForecastAtHour(lat, lon, h);

      try {
        // ── Gemini classification with exact required prompt ──
        const result = await classifyWithGemini(newLabel, h, forecast);
        conflict       = result.conflict;
        conflictReason = result.reason || null;
        fix            = result.suggestion || "";
      } catch (geminiErr) {
        console.warn("Gemini classification failed, using fallback", geminiErr);
        // ── Required fallback ──
        const fb = fallbackConflict(forecast);
        conflict       = fb.conflict;
        conflictReason = fb.conflictReason;
        fix            = fb.fix;
      }
    } catch (forecastErr) {
      console.warn("Forecast fetch failed", forecastErr);
    }

    const newItem = {
      id: Date.now(),
      label: newLabel,
      time: formatTime(newTime),
      hour: h,
      icon,
      weatherConflict: conflict,
      weatherReason:   conflictReason,
      weatherFix:      fix,
      conflict,
      conflictReason,
      fix,
    };

    userAddedIds.current.add(newItem.id);

    setItems((prev) => {
      const next = [...prev, newItem];
      return applyOverlapConflicts(next);
    });

    if (conflict) toast(`⚠️ ${conflictReason || "Weather conflict detected"}`);
    else toast("Plan added ✅");

    setNewLabel(""); setNewTime(""); setShowForm(false); setAdding(false);
  };

  return (
    <aside className="rpanel">
      <div className="task-title">
        Reschedule Alerts
        {evaluating && (
          <span style={{ fontSize: 10, color: "#b89880", marginLeft: 8, fontWeight: 400 }}>
            checking weather…
          </span>
        )}
      </div>

      {items.map((i) => (
        <RescheduleItem key={i.id} item={i} onResolve={resolve} onDelete={deleteItem} toast={toast} />
      ))}

      {showForm ? (
        <div className="inline-add" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <input
            type="text" placeholder="Activity name (e.g. Evening Run)"
            value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <input
            type="time" value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="confirm-btn"
              style={{ flex: 1, opacity: adding ? 0.6 : 1 }}
              onClick={addPlan}
              disabled={adding}
            >
              {adding ? "Checking weather…" : "✔ Add Plan"}
            </button>
            <button className="tbtn doneb" onClick={() => { setShowForm(false); setNewLabel(""); setNewTime(""); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="addbtn" onClick={() => setShowForm(true)}>＋ Add Plan</button>
      )}

      <hr className="idivider" />

      {/* <WeatherChat tasks={items} weather={weather} /> */}
    </aside>
  );
}