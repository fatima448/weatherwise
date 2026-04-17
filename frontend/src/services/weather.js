// src/services/weather.js

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const ML_BACKEND_URL = "http://localhost:8000"; 

// ── Fetch raw weather ─────────────────────────────────────────────────────
export async function getWeather(lat = 41.01, lon = 28.97) {
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,precipitation,` +
    `windspeed_10m,weathercode,relative_humidity_2m,uv_index` +
    `&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather data");
  return res.json();
}

// ── NEW: Single call that returns clothing + umbrella + activity suggestions
export async function getMLPredictionAll(lat = 41.01, lon = 28.97) {
  console.log("Calling backend:", `${ML_BACKEND_URL}/predict/all`);
  const res = await fetch(`${ML_BACKEND_URL}/predict/all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "ML prediction failed");
  }

  const data = await res.json();
  console.log("✅ ML ALL DATA:", data);
  return data;
}

// ── Legacy /predict endpoint (kept for backwards compat) ─────────────────
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

// ── Get forecast conditions at a specific hour (for conflict detection) ────
export async function getForecastAtHour(lat = 41.01, lon = 28.97, targetHour) {
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch forecast");
  const data = await res.json();

  const hourIndex = data.hourly.time.findIndex(
    (t) => new Date(t).getHours() === targetHour
  );

  if (hourIndex === -1) return null;

  return {
    precipitation_probability: data.hourly.precipitation_probability[hourIndex],
    weathercode:               data.hourly.weathercode[hourIndex],
    windspeed:                 data.hourly.windspeed_10m[hourIndex],
    temperature:               data.hourly.temperature_2m[hourIndex],
  };
}

// ── Clothing label map ────────────────────────────────────────────────────
export function clothingLabel(raw) {
  const map = {
    heavy_winter_coat_gloves_hat:      "Heavy winter coat + gloves + hat",
    winter_coat_scarf_gloves:          "Winter coat, scarf & gloves",
    warm_jacket_layers:                "Warm jacket with layers",
    light_jacket_or_sweater:           "Light jacket or sweater",
    long_sleeves_light_layer:          "Long sleeves + light layer",
    t_shirt_comfortable:               "Comfortable t-shirt",
    light_breathable_clothing:         "Light, breathable clothing",
    very_light_clothing_stay_hydrated: "Very light clothing — stay hydrated!",
  };
  return map[raw] ?? raw.replaceAll("_", " ");
}