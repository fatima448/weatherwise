// src/components/SmartSuggestions.jsx
import { clothingLabel } from "../services/weather";
import {
  getExtraAdvice,
  getWeatherAlert,
  filterActivitiesByWeather,
} from "../utils/weatherHelpers";

// ─── Clothing emoji map ────────────────────────────────────────────────────────
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

// ─── Safety Check Card ────────────────────────────────────────────────────────
function SafetyCheckCard({ mlInsights }) {
  if (!mlInsights) {
    return (
      <div className="scard amber">
        <div className="sicon">🛡️</div>
        <div className="stxt">Checking conditions…</div>
        <span className="stag amber">One moment</span>
      </div>
    );
  }

  const {
    uvProtection,
    hydrationAlert,
    roadSurface,
    windAlert,
    windChillWarning,
    outdoorPoor,
  } = mlInsights;

  const activeAlerts = [
    hydrationAlert.triggered,
    windAlert.triggered,
    windChillWarning.triggered,
    outdoorPoor.triggered,
  ].filter(Boolean).length;

  const cardColor = activeAlerts >= 2 ? "red" : "amber";

  const headline =
    outdoorPoor.triggered                 ? "It's rough out there — better to stay in"
    : windChillWarning.triggered          ? "Bundle up, it feels colder than it looks"
    : windAlert.triggered                 ? "Heads up — strong gusts out there"
    : hydrationAlert.triggered            ? "Drink some water, it's warm today"
    : roadSurface.label === "icy"         ? "Roads are icy — take it slow"
    : roadSurface.label === "wet"         ? "Roads are wet — give extra space"
    : uvProtection.label === "sunscreen"  ? "Don't forget sunscreen before heading out"
    : uvProtection.label === "sunglasses" ? "Grab your sunglasses — UV is moderate"
    :                                       "You're good to go";

  const tag =
    activeAlerts === 0
      ? "All good"
      : `${activeAlerts} heads-up${activeAlerts > 1 ? "s" : ""}`;

  return (
    <div className={`scard ${cardColor}`}>
      <div className="sicon">🛡️</div>
      <div className="stxt">{headline}</div>
      <span className={`stag ${cardColor}`}>{tag}</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
// timezone is now received and passed into getWeatherAlert so it reads
// the correct hour slot for whichever city is being viewed
export default function SmartSuggestions({ mlPrediction, weather, mlInsights, timezone }) {
  const weatherCode = weather?.current?.weathercode ?? 0;
  const alert       = getWeatherAlert(weather, timezone);  // ← timezone passed here

  // ── ML-powered path ──────────────────────────────────────────────────────────
  if (mlPrediction && mlPrediction.activity_suggestions?.length > 0) {
    const filteredActivities = filterActivitiesByWeather(
      mlPrediction.activity_suggestions,
      weatherCode,
    );

    // Only show activities the model is at least 60% confident about
    const confidentActivities = filteredActivities.filter(
      (a) => a.confidence >= 0.6
    );

    return (
      <div>
        <div className="smart-title">Smart Suggestions</div>
        <div className="sgrid">

          {/* Card 1 — Clothing */}
          <div className="scard violet">
            <div className="sicon">{CLOTHING_EMOJI[mlPrediction.clothing_recommendation] ?? "👕"}</div>
            <div className="stxt">{clothingLabel(mlPrediction.clothing_recommendation)}</div>
            <span className="stag violet">Now</span>
          </div>

          {/* Card 2 — Safety Check */}
          <SafetyCheckCard mlInsights={mlInsights} />

          {/* Card 3 — Top activities (60%+ confidence only) */}
          <div className="scard green">
            <div className="sicon">{confidentActivities[0]?.emoji ?? "🏃"}</div>
            <div className="stxt">Best activities now</div>

            <div style={{ margin: "8px 0 10px" }}>
              {confidentActivities.length > 0 ? (
                confidentActivities.map((a, ai, arr) => (
                  <div
                    key={ai}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 0",
                      borderBottom: ai < arr.length - 1
                        ? "1px solid rgba(52,211,153,0.12)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{a.emoji}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 600,
                      fontFamily: "var(--font-d)",
                      color: "var(--text)", flex: 1,
                    }}>
                      {a.label}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "var(--green)",
                      background: "rgba(52,211,153,0.12)",
                      borderRadius: 99, padding: "2px 7px",
                    }}>
                      {Math.round(a.confidence * 100)}%
                    </span>
                  </div>
                ))
              ) : (
                <div style={{
                  fontSize: 12, color: "var(--text2)",
                  fontStyle: "italic", fontFamily: "var(--font-s)",
                  lineHeight: 1.5,
                }}>
                  Conditions aren't great for activities right now
                </div>
              )}
            </div>

            <span className="stag green">Best now</span>
          </div>

          {/* Card 4 — Weather alert (next 6 hours, timezone-aware) */}
          <div className={`scard ${alert?.color ?? "green"}`}>
            <div className="sicon">{alert?.icon ?? "✅"}</div>
            <div className="stxt">{alert?.title ?? "Weather looks stable"}</div>
            {alert?.body && (
              <div style={{
                fontSize: 12, color: "var(--text2)", fontStyle: "italic",
                lineHeight: 1.5, margin: "6px 0 10px",
                fontFamily: "var(--font-s)",
              }}>
                {alert.body}
              </div>
            )}
            <span className={`stag ${alert?.color ?? "green"}`}>
              {alert?.tag ?? "All clear"}
            </span>
          </div>

        </div>
      </div>
    );
  }

  // ── Fallback when ML is offline ──────────────────────────────────────────────
  const fallback = [
    { icon: "🧥", text: "Light jacket for this evening", tag: "6 PM+",      color: "violet" },
    { icon: "🛡️", text: "Checking conditions…",          tag: "One moment", color: "amber"  },
    { icon: "🚶", text: "Perfect for a walk right now",  tag: "Now",        color: "green"  },
    { icon: "🌿", text: "Low pollen today",              tag: "All day",    color: "amber"  },
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