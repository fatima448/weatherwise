// src/services/weather.js

const OPEN_METEO_URL  = "https://api.open-meteo.com/v1/forecast";
const GEO_URL         = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEO_URL = "https://nominatim.openstreetmap.org/reverse";
const ML_BACKEND_URL  = "http://localhost:8000";

// ── 1. Get user's current location (browser Geolocation API — FREE) ────────
export function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000 }
    );
  });
}

// ── 2. Reverse geocode lat/lon → city name (Nominatim — FREE, no key) ─────
export async function getCityName(lat, lon) {
  try {
    const res = await fetch(
      `${REVERSE_GEO_URL}?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    // Nominatim returns address.city, address.town, or address.village
    return (
      data.address?.city    ||
      data.address?.town    ||
      data.address?.village ||
      data.address?.county  ||
      "Your location"
    );
  } catch {
    return "Your location";
  }
}

// ── 3. Search city by name → lat/lon + city name ───────────────────────────
export async function searchCity(cityName) {
  const res = await fetch(
    `${GEO_URL}?name=${encodeURIComponent(cityName)}&count=1&language=en`
  );
  const data = await res.json();
  if (!data.results?.length) throw new Error("City not found");
  const { latitude, longitude, name, country } = data.results[0];
  return { lat: latitude, lon: longitude, cityName: `${name}, ${country}` };
}

// ── 4. Fetch raw weather + hourly forecast ─────────────────────────────────
export async function getWeather(lat, lon) {
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,precipitation,` +
    `wind_speed_10m,weathercode,relative_humidity_2m,uv_index` +
    `&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch weather data");
  return res.json();
}

// ── 5. ML prediction (clothing + umbrella + activities) ───────────────────
export async function getMLPredictionAll(lat, lon) {
  const res = await fetch(`${ML_BACKEND_URL}/predict/all`, {
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

// ── 6. Legacy /predict (backwards compat) ────────────────────────────────
export async function getMLPrediction(lat, lon) {
  const res = await fetch(`${ML_BACKEND_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon }),
  });
  if (!res.ok) throw new Error("ML prediction failed");
  return res.json();
}

// ── 7. Forecast at a specific hour (conflict detection) ───────────────────
export async function getForecastAtHour(lat, lon, targetHour) {
  const url =
    `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m` +
    `&timezone=auto&forecast_days=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch forecast");
  const data = await res.json();

  const idx = data.hourly.time.findIndex(
    (t) => new Date(t).getHours() === targetHour
  );
  if (idx === -1) return null;

  return {
    precipitation_probability: data.hourly.precipitation_probability[idx],
    weathercode:               data.hourly.weathercode[idx],
    windspeed:                 data.hourly.windspeed_10m[idx],
    temperature:               data.hourly.temperature_2m[idx],
  };
}

// ── 8. Clothing label map ─────────────────────────────────────────────────
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