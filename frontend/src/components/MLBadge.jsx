// src/components/MLBadge.jsx
// 8 AI models panel. Defensive: handles any shape the service returns.

import { useState, useEffect, useRef } from "react";

const MODEL_META = {
  clothing:         { name: "Clothing Advisor",   icon: "👕" },
  umbrella:         { name: "Umbrella Needed",    icon: "☔" },
  uvProtection:     { name: "UV Protection",      icon: "☀️" },
  hydrationAlert:   { name: "Hydration Alert",    icon: "💧" },
  roadSurface:      { name: "Road Surface",       icon: "🛣️" },
  windAlert:        { name: "Wind Alert",         icon: "💨" },
  windChillWarning: { name: "Wind Chill",         icon: "🥶" },
  outdoorPoor:      { name: "Outdoor Conditions", icon: "🌿" },
};

function getStatus(key, val, mlPrediction) {
  if (key === "clothing") {
    const rec = mlPrediction?.clothing_recommendation;
    if (!rec) return { label: "—", active: false };
    const heavy = rec.includes("winter") || rec.includes("coat");
    return { label: heavy ? "Layer up" : "Light wear", active: heavy };
  }
  if (key === "umbrella") {
    const needed = mlPrediction?.umbrella_needed;
    if (needed === undefined) return { label: "—", active: false };
    return { label: needed ? "Bring one!" : "Not needed", active: needed };
  }
  if (!val) return { label: "—", active: false };
  if (key === "uvProtection") {
    const lbl = val.label;
    if (!lbl || lbl === "none") return { label: "No risk", active: false };
    return { label: lbl, active: true };
  }
  if (key === "roadSurface") {
    const lbl = val.label || "dry";
    return { label: lbl, active: lbl !== "dry" };
  }
  const triggered = val.triggered === true;
  return { label: triggered ? "Alert" : "Clear", active: triggered };
}

export default function MLBadge({ mlInsights, mlPrediction }) {
  const [open, setOpen] = useState(false);
  const wrapperRef      = useRef(null);

  // ── Close dropdown when the user scrolls anywhere ──────────────────────
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  // ── Close dropdown when clicking outside ───────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const allModels   = Object.entries(MODEL_META);
  const activeCount = allModels.filter(([key]) => {
    const val =
      key === "clothing" ? mlPrediction?.clothing_recommendation
      : key === "umbrella" ? mlPrediction?.umbrella_needed
      : mlInsights?.[key];
    return getStatus(key, val, mlPrediction).active;
  }).length;

  const isLoading = !mlPrediction && !mlInsights;

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 12px", borderRadius: 99,
          border: "1px solid rgba(167,139,250,0.3)",
          background: "rgba(167,139,250,0.1)",
          color: "var(--violet)",
          fontFamily: "var(--font-d)", fontSize: 12, fontWeight: 700,
          cursor: "pointer", backdropFilter: "blur(8px)",
          transition: "all 0.18s", whiteSpace: "nowrap",
        }}
      >
        🤖 8 AI Models
        {!isLoading && activeCount > 0 && (
          <span style={{
            background: "#f87171", color: "#fff", borderRadius: 99,
            fontSize: 10, fontWeight: 800, padding: "1px 6px", marginLeft: 2,
          }}>
            {activeCount} alert{activeCount > 1 ? "s" : ""}
          </span>
        )}
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          className="ml-dropdown"
          style={{
            // ── Stays absolutely positioned relative to its parent ──────
            // On mobile the CSS overrides in App.css previously set
            // position:fixed which caused it to scroll with the page.
            // Now we keep it absolute everywhere and just adjust width.
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 9999,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(16px)",
            borderRadius: 16,
            border: "1px solid rgba(167,139,250,0.2)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            padding: "14px",
            minWidth: 260,
            // Prevent overflow off-screen on narrow viewports
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 2,
            textTransform: "uppercase", color: "#b89880",
            marginBottom: 10, fontFamily: "var(--font-d)",
          }}>
            AI Models Running Now
          </div>

          {isLoading ? (
            <div style={{
              fontSize: 12, color: "#9ca3af", fontStyle: "italic",
              fontFamily: "var(--font-s)", padding: "8px 0",
            }}>
              Loading models…
            </div>
          ) : (
            allModels.map(([key, meta]) => {
              const val    = mlInsights?.[key];
              const status = getStatus(key, val, mlPrediction);
              return (
                <div key={key} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 0", borderBottom: "1px solid rgba(0,0,0,0.05)",
                }}>
                  <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>
                    {meta.icon}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 12, fontWeight: 600,
                    color: "#413025", fontFamily: "var(--font-d)",
                  }}>
                    {meta.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                    background: status.active
                      ? "rgba(248,113,113,0.15)"
                      : status.label === "—"
                        ? "rgba(0,0,0,0.05)"
                        : "rgba(74,222,128,0.15)",
                    color: status.active
                      ? "#ef4444"
                      : status.label === "—"
                        ? "#9ca3af"
                        : "#16a34a",
                  }}>
                    {status.label}
                  </span>
                </div>
              );
            })
          )}

          <div style={{
            marginTop: 10, fontSize: 10, color: "#b89880",
            fontStyle: "italic", textAlign: "center", fontFamily: "var(--font-s)",
          }}>
            8 Gradient Boosting models · 43,440 observations · client-side
          </div>
        </div>
      )}
    </div>
  );
}