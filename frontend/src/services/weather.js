const BASE_URL = "https://api.open-meteo.com/v1/forecast";

export async function getWeather(lat = 41.01, lon = 28.97) {
const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,windspeed_10m,weathercode&hourly=temperature_2m,precipitation_probability&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch weather data");
  }
  const data = await response.json();
  return data;
}