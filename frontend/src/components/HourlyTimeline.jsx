// src/components/HourlyTimeline.jsx
// Visual hourly timeline showing weather + task conflicts for the day.
// Add below WeatherCard in App.jsx — does NOT change any existing code.

import { useMemo } from "react";

// Weather code → short label + color
function weatherSummary(code) {
  if (code === 0)              return { label: "Clear",   color: "#4ade80", icon: "☀️" };
  if (code <= 2)               return { label: "Cloudy",  color: "#94a3b8", icon: "⛅" };
  if (code <= 48)              return { label: "Foggy",   color: "#94a3b8", icon: "🌫️" };
  if (code <= 67)              return { label: "Rain",    color: "#38bdf8", icon: "🌧️" };
  if (code <= 77)              return { label: "Snow",    color: "#e0f2fe", icon: "❄️" };
  if (code <= 82)              return { label: "Showers", color: "#38bdf8", icon: "🌦️" };
  if (code >= 95)              return { label: "Storm",   color: "#f87171", icon: "⛈️" };
  return                              { label: "Mixed",   color: "#94a3b8", icon: "🌤️" };
}

function isBadWeather(code, rainProb) {
  return rainProb > 50 || code >= 51;
}

export default function HourlyTimeline({ weather, tasks }) {
  const hours = useMemo(() => {
    if (!weather?.hourly) return [];
    const now = new Date().getHours();

    // Show next 12 hours from now
    return Array.from({ length: 12 }, (_, i) => {
      const h = (now + i) % 24;
      const idx = weather.hourly.time?.findIndex(t => new Date(t).getHours() === h) ?? -1;
      if (idx === -1) return null;

      const code     = weather.hourly.weathercode?.[idx] ?? 0;
      const rainProb = weather.hourly.precipitation_probability?.[idx] ?? 0;
      const temp     = weather.hourly.temperature_2m?.[idx] ?? 0;
      const wind     = weather.hourly.windspeed_10m?.[idx] ?? 0;
      const bad      = isBadWeather(code, rainProb);

      // Find tasks scheduled at this hour
      const tasksAtHour = tasks.filter(t => t.hour === h);
      const conflicting = tasksAtHour.filter(t => t.conflict);

      return { h, code, rainProb, temp, wind, bad, tasksAtHour, conflicting, ...weatherSummary(code) };
    }).filter(Boolean);
  }, [weather, tasks]);

  if (!hours.length) return null;

  const hasAnyConflict = hours.some(h => h.conflicting.length > 0);

  return (
    <div style={{
      margin: "20px 0",
      background: "rgba(255,255,255,0.25)",
      backdropFilter: "blur(12px)",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.2)",
      padding: "18px 20px",
      animation: "fadeUp 0.4s ease",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16,
      }}>
        <div style={{
          fontFamily: "var(--font-d)", fontSize: 11, fontWeight: 800,
          letterSpacing: 2.5, textTransform: "uppercase", color: "#b89880",
        }}>
          Today's Hourly Forecast
        </div>
        {hasAnyConflict && (
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#f87171",
            background: "rgba(248,113,113,0.12)",
            borderRadius: 99, padding: "3px 10px",
          }}>
            ⚠️ Task conflicts detected
          </div>
        )}
      </div>

      {/* Scrollable hour strip */}
      <div style={{
        display: "flex", gap: 8,
        overflowX: "auto", paddingBottom: 4,
        scrollbarWidth: "none",
      }}>
        {hours.map(({ h, icon, label, color, rainProb, temp, tasksAtHour, conflicting, bad }) => {
          const hasConflict = conflicting.length > 0;
          const hasTask     = tasksAtHour.length > 0;

          return (
            <div
              key={h}
              title={
                hasConflict
                  ? `⚠️ ${conflicting.map(t => t.label).join(", ")} — conflict`
                  : hasTask
                  ? `✅ ${tasksAtHour.map(t => t.label).join(", ")}`
                  : label
              }
              style={{
                minWidth: 58, flexShrink: 0,
                borderRadius: 14,
                padding: "10px 6px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                background: hasConflict
                  ? "rgba(248,113,113,0.18)"
                  : hasTask
                  ? "rgba(74,222,128,0.13)"
                  : bad
                  ? "rgba(56,189,248,0.1)"
                  : "rgba(255,255,255,0.15)",
                border: hasConflict
                  ? "1.5px solid rgba(248,113,113,0.5)"
                  : hasTask
                  ? "1.5px solid rgba(74,222,128,0.35)"
                  : "1px solid rgba(255,255,255,0.15)",
                transition: "all 0.18s",
                cursor: hasTask || hasConflict ? "pointer" : "default",
                position: "relative",
              }}
            >
              {/* Hour label */}
              <div style={{
                fontSize: 10, fontWeight: 700,
                fontFamily: "var(--font-d)",
                color: hasConflict ? "#f87171" : "#b89880",
              }}>
                {h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`}
              </div>

              {/* Weather icon */}
              <div style={{ fontSize: 20 }}>{icon}</div>

              {/* Temp */}
              <div style={{
                fontSize: 11, fontWeight: 700, color: "var(--text)",
                fontFamily: "var(--font-d)",
              }}>
                {Math.round(temp)}°
              </div>

              {/* Rain prob if significant */}
              {rainProb > 20 && (
                <div style={{
                  fontSize: 10, color: "#38bdf8", fontWeight: 600,
                  fontFamily: "var(--font-s)",
                }}>
                  {rainProb}%
                </div>
              )}

              {/* Task indicator */}
              {hasTask && (
                <div style={{
                  fontSize: 12,
                  title: tasksAtHour.map(t => t.icon).join(""),
                }}>
                  {tasksAtHour.slice(0, 2).map(t => t.icon).join("")}
                </div>
              )}

              {/* Conflict badge */}
              {hasConflict && (
                <div style={{
                  position: "absolute", top: -6, right: -6,
                  background: "#f87171", color: "#fff",
                  borderRadius: 99, fontSize: 9, fontWeight: 800,
                  padding: "1px 5px", border: "2px solid white",
                }}>
                  ⚠️
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap",
      }}>
        {[
          { color: "rgba(248,113,113,0.4)", label: "Task conflict" },
          { color: "rgba(74,222,128,0.3)",  label: "Task scheduled" },
          { color: "rgba(56,189,248,0.2)",  label: "Bad weather" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ fontSize: 10, color: "#b89880", fontFamily: "var(--font-s)" }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
