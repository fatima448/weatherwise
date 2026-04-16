// src/services/weather.js
// Fetches live weather from Open-Meteo AND the ML clothing prediction
// from your local FastAPI backend.

const OPEN_METEO_URL  = "https://api.open-meteo.com/v1/forecast";
const ML_BACKEND_URL  = "http://localhost:8000";   // <── change if deployed elsewhere

// ── Raw weather from Open-Meteo (unchanged, used by the existing UI) ──────
export async function getWeather(lat = 41.01, lon = 28.97) {
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,precipitation,` +
    `windspeed_10m,weathercode,relative_humidity_2m,uv_index` +
    `&hourly=temperature_2m,precipitation_probability&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather data");
  return res.json();
}

// ── ML clothing + umbrella prediction from your backend ───────────────────
/**
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{
 *   clothing_recommendation: string,
 *   clothing_confidence: number,
 *   umbrella_needed: boolean,
 *   umbrella_confidence: number,
 *   temperature_c: number,
 *   feels_like_c: number,
 *   weather_condition: string,
 *   hour_of_day: number,
 *   season: string,
 *   recommendation_text: string,
 * }>}
 */
export async function getMLPrediction(lat = 41.01, lon = 28.97) {
  const res = await fetch(`${ML_BACKEND_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "ML prediction failed");
  }
  return res.json();
}

// ── Human-readable label helper ───────────────────────────────────────────
export function clothingLabel(raw) {
  const map = {
    heavy_winter_coat_gloves_hat:       "Heavy winter coat + gloves + hat",
    winter_coat_scarf_gloves:            "Winter coat, scarf & gloves",
    warm_jacket_layers:                  "Warm jacket with layers",
    light_jacket_or_sweater:             "Light jacket or sweater",
    long_sleeves_light_layer:            "Long sleeves + light layer",
    t_shirt_comfortable:                 "Comfortable t-shirt",
    light_breathable_clothing:           "Light, breathable clothing",
    very_light_clothing_stay_hydrated:   "Very light clothing — stay hydrated!",
  };
  return map[raw] ?? raw.replaceAll("_", " ");
}
