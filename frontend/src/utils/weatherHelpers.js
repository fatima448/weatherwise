// src/utils/weatherHelpers.js
// Pure helper functions — no React, no side effects

export function getWeatherTheme(code, isDay) {
  if (code === 0)
    return {
      bg: isDay
        ? "linear-gradient(135deg, #FFD700, #FFA500)" // day
        : "linear-gradient(135deg, #1e3a8a, #3730a3)", // night (soft blue/purple)
      accent: isDay ? "#F59E0B" : "#c4b5fd",
      text: isDay ? "#1A0F00" : "#F1F5F9",
      condColor: isDay ? "#F59E0B" : "#ddd6fe",
      type: "sunny",
    };
  if (code <= 2)
    return {
      bg: "linear-gradient(135deg, #87CEEB, #B0C4DE)",
      accent: "#60A5FA",
      text: "#1A0F00",
      condColor: "#5f87c7ff",
      type: "cloudy",
    };
  if (code === 3)
    return {
      bg: "linear-gradient(135deg, #9CA3AF, #6B7280)",
      accent: "#9CA3AF",
      text: "#FFFFFF",
      condColor: "#D1D5DB",
      type: "overcast",
    };
  if (code <= 67)
    return {
      bg: "linear-gradient(135deg, #4A7FA5, #2C5F7A)",
      accent: "#3B82F6",
      text: "#FFFFFF",
      condColor: "#60A5FA",
      type: "rainy",
    };
  if (code <= 77)
    return {
      bg: "linear-gradient(135deg, #E0F2FE, #BAE6FD)",
      accent: "#7DD3FC",
      text: "#1A0F00",
      condColor: "#38BDF8",
      type: "snowy",
    };
  if (code <= 99)
    return {
      bg: "linear-gradient(135deg, #1F2937, #374151)",
      accent: "#818CF8",
      text: "#FFFFFF",
      condColor: "#A78BFA",
      type: "storm",
    };
  return {
    bg: "linear-gradient(135deg, #D1FAE5, #6EE7B7)",
    accent: "#10B981",
    text: "#1A0F00",
    condColor: "#10B981",
    type: "default",
  };
}

export function describeWeather(code, isDay) {
  if (code === 0) {
    return {
      text: "Clear sky",
      emoji: isDay ? "☀️" : "🌙",
    };
  }

  if (code <= 2) {
    return {
      text: "Partly cloudy",
      emoji: isDay ? "⛅" : "☁️",
    };
  }

  if (code === 3) {
    return {
      text: "Overcast",
      emoji: "☁️",
    };
  }

  if (code <= 49) {
    return {
      text: "Foggy",
      emoji: "🌫️",
    };
  }

  if (code <= 67) {
    return {
      text: "Rainy",
      emoji: "🌧️",
    };
  }

  if (code <= 77) {
    return {
      text: "Snowy",
      emoji: "❄️",
    };
  }

  if (code <= 82) {
    return {
      text: "Showers",
      emoji: isDay ? "🌦️" : "🌧️",
    };
  }

  if (code <= 99) {
    return {
      text: "Thunderstorm",
      emoji: "⛈️",
    };
  }

  return {
    text: "Unknown",
    emoji: "🌡️",
  };
}
export function getLocalHour(timezone) {
  return Number(
    new Date().toLocaleString("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    })
  );
}
export function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 22) return "Good Evening";
  return "Good Night";
}

export function formatDate(timeString) {
  return new Date(timeString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(time) {
  const [h, m] = time.split(":");
  const hour = h % 12 || 12;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${hour}:${m} ${ampm}`;
}

// ── Umbrella: check BOTH ML prediction AND raw weather code ───────────────
// The ML model sometimes misses rain — this adds a hard rule fallback
export function shouldBringUmbrella(mlPrediction, weatherCode) {
  // Hard rule: if it's actually raining/drizzling/storming right now → always umbrella
  const isRainingNow = weatherCode >= 51 && weatherCode <= 99;
  return isRainingNow || mlPrediction?.umbrella_needed === true;
}

// ── Extra advice card (card 2) ────────────────────────────────────────────
export function getExtraAdvice(weather, mlPrediction) {
  const temp = weather?.current?.temperature_2m ?? 0;
  const uv = weather?.current?.uv_index ?? 0;
  const code = weather?.current?.weathercode ?? 0;

  // Always check actual weather code first — don't trust ML alone for rain
  if (shouldBringUmbrella(mlPrediction, code))
    return { icon: "☔", text: "Take an umbrella", tag: "Now", color: "blue" };
  if (uv >= 6)
    return { icon: "🧴", text: "Use sunscreen", tag: "Now", color: "amber" };
  if (uv >= 3)
    return {
      icon: "🕶️",
      text: "Sunglasses will help",
      tag: "Now",
      color: "amber",
    };
  if (temp >= 28)
    return { icon: "💧", text: "Stay hydrated", tag: "Now", color: "blue" };
  return {
    icon: "🌤️",
    text: "No umbrella needed",
    tag: "Today",
    color: "blue",
  };
}

// ── Weather alert for the next 6 hours (card 4) ───────────────────────────
export function getWeatherAlert(weatherData) {
  if (!weatherData?.hourly) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const startIndex = weatherData.hourly.time.findIndex(
    (t) => new Date(t).getHours() === currentHour,
  );
  if (startIndex === -1) return null;

  const currentTemp = weatherData.hourly.temperature_2m[startIndex];
  const currentCode = weatherData.hourly.weathercode[startIndex];
  const currentRain = weatherData.hourly.precipitation_probability[startIndex];

  for (let i = 1; i <= 6; i++) {
    const idx = startIndex + i;
    if (idx >= weatherData.hourly.time.length) break;

    const time = new Date(weatherData.hourly.time[idx]);
    const h = time.getHours();
    const period = h >= 12 ? "PM" : "AM";
    const display = `${h % 12 === 0 ? 12 : h % 12} ${period}`;

    const temp = weatherData.hourly.temperature_2m[idx];
    const rain = weatherData.hourly.precipitation_probability[idx];
    const code = weatherData.hourly.weathercode[idx];
    const wind = weatherData.hourly.windspeed_10m?.[idx] ?? 0;
    const tempDrop = currentTemp - temp;

    if (rain >= 60 && currentRain < 40)
      return {
        icon: "🌧️",
        title: "Rain coming",
        body: `${rain}% chance of rain around ${display}`,
        tag: "Heads up",
        color: "blue",
      };
    if (code >= 95)
      return {
        icon: "⛈️",
        title: "Storm approaching",
        body: `Thunderstorm expected around ${display}`,
        tag: "Warning",
        color: "red",
      };
    if (tempDrop >= 5)
      return {
        icon: "🥶",
        title: "Temperature dropping",
        body: `Drops ${Math.round(tempDrop)}° colder by ${display}`,
        tag: "Heads up",
        color: "blue",
      };
    if (wind > 40 && (weatherData.hourly.windspeed_10m?.[startIndex] ?? 0) < 25)
      return {
        icon: "💨",
        title: "Strong winds ahead",
        body: `Wind picks up significantly around ${display}`,
        tag: "Heads up",
        color: "amber",
      };
    if (code >= 71 && code <= 77 && currentCode < 71)
      return {
        icon: "❄️",
        title: "Snow expected",
        body: `Snow likely around ${display}`,
        tag: "Warning",
        color: "blue",
      };
  }

  return {
    icon: "✅",
    title: "Weather looks stable",
    body: "No significant changes in the next 6 hours",
    tag: "All clear",
    color: "green",
  };
}

// ── Activity suggestions: re-evaluate based on ACTUAL weather ─────────────
// If weather is rainy/stormy, filter out outdoor activities
const OUTDOOR_ACTIVITIES = new Set([
  "running",
  "cycling",
  "walking",
  "picnic",
  "sports",
  "outdoor_work",
]);

export function filterActivitiesByWeather(activitySuggestions, weatherCode) {
  const isBadWeather = weatherCode >= 51; // drizzle or worse

  if (!isBadWeather) return activitySuggestions; // all good, show ML results as-is

  // In bad weather: demote outdoor activities, promote indoor ones
  return activitySuggestions
    .map((a) => ({
      ...a,
      // Reduce confidence of outdoor activities in rain
      confidence: OUTDOOR_ACTIVITIES.has(a.activity)
        ? a.confidence * 0.3
        : a.confidence * 1.2,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
