// src/components/SmartSuggestions.jsx
import { clothingLabel } from "../services/weather";
import {
  getExtraAdvice,
  getWeatherAlert,
  filterActivitiesByWeather,
  shouldBringUmbrella,
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

// ─── Merged Umbrella + Safety Card ───────────────────────────────────────────
// All original logic for both cards is preserved — they're just rendered
// together in one card with a thin divider between them.
function UmbrellaSafetyCard({ mlPrediction, mlInsights, weatherCode }) {
  // ── Umbrella logic (unchanged) ──────────────────────────────────────────
  const umbrellaNeeded = shouldBringUmbrella(mlPrediction, weatherCode);
  const umbrellaColor  = umbrellaNeeded ? "blue" : "green";

  // ── Safety logic (unchanged) ────────────────────────────────────────────
  const safetyLoading = !mlInsights;

  let safetyHeadline = "Checking conditions…";
  let activeAlerts   = 0;
  let safetyColor    = "amber";

  if (mlInsights) {
    const {
      uvProtection, hydrationAlert, roadSurface,
      windAlert, windChillWarning, outdoorPoor,
    } = mlInsights;

    activeAlerts = [
      hydrationAlert.triggered,
      windAlert.triggered,
      windChillWarning.triggered,
      outdoorPoor.triggered,
    ].filter(Boolean).length;

    safetyColor = activeAlerts >= 2 ? "red" : "amber";

    safetyHeadline =
      outdoorPoor.triggered                 ? "Better to stay in today"
      : windChillWarning.triggered          ? "Feels colder than it looks"
      : windAlert.triggered                 ? "Strong gusts out there"
      : hydrationAlert.triggered            ? "Stay hydrated today"
      : roadSurface.label === "icy"         ? "Roads are icy — take it slow"
      : roadSurface.label === "wet"         ? "Roads are wet — give extra space"
      : uvProtection.label === "sunscreen"  ? "Don't forget sunscreen"
      : uvProtection.label === "sunglasses" ? "Grab your sunglasses"
      :                                       "You're good to go";
  }

  const safetyTag = safetyLoading
    ? "One moment"
    : activeAlerts === 0
      ? "All good"
      : `${activeAlerts} heads-up${activeAlerts > 1 ? "s" : ""}`;

  // The card takes the color of whichever sub-section has the higher priority:
  // active safety alert > umbrella needed > green
  const cardColor =
    (safetyColor === "red")                          ? "red"
    : (activeAlerts > 0)                             ? safetyColor
    : umbrellaNeeded                                 ? "blue"
    :                                                  "green";

  return (
    <div className={`scard ${cardColor}`}>

      {/* ── Umbrella section ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>
          {umbrellaNeeded ? "☔" : "🌂"}
        </div>
        <div style={{ flex: 1 }}>
          <div className="stxt" style={{ marginBottom: 2 }}>
            {umbrellaNeeded ? "Bring an umbrella" : "No umbrella needed"}
          </div>
          {mlPrediction?.umbrella_confidence !== undefined && (
            <div style={{
              fontSize: 11, color: "var(--text2)", fontStyle: "italic",
              fontFamily: "var(--font-s)",
            }}>
              {Math.round(mlPrediction.umbrella_confidence * 100)}% confidence
            </div>
          )}
        </div>
        <span className={`stag ${umbrellaColor}`} style={{ flexShrink: 0 }}>Now</span>
      </div>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <div style={{
        borderTop: `1px solid rgba(0,0,0,0.07)`,
        margin: "4px 0 10px",
      }} />

      {/* ── Safety section ───────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 22, lineHeight: 1 }}>🛡️</div>
        <div style={{ flex: 1 }}>
          <div className="stxt" style={{ marginBottom: 2 }}>{safetyHeadline}</div>
        </div>
        <span className={`stag ${safetyColor}`} style={{ flexShrink: 0 }}>
          {safetyTag}
        </span>
      </div>

    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SmartSuggestions({ mlPrediction, weather, mlInsights, timezone }) {
  const weatherCode = weather?.current?.weathercode ?? 0;
  const alert       = getWeatherAlert(weather, timezone);

  // ── ML-powered path ──────────────────────────────────────────────────────────
  if (mlPrediction && mlPrediction.activity_suggestions?.length > 0) {
    const filteredActivities = filterActivitiesByWeather(
      mlPrediction.activity_suggestions,
      weatherCode,
    );

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

          {/* Card 2 — Umbrella + Safety merged (all original logic preserved) */}
          <UmbrellaSafetyCard
            mlPrediction={mlPrediction}
            mlInsights={mlInsights}
            weatherCode={weatherCode}
          />

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