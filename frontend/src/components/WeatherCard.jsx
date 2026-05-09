// src/components/WeatherCard.jsx
import { describeWeather } from "../utils/weatherHelpers";

export default function WeatherCard({ current, theme, timezone }) {
  const localHour = getLocalHourInTz(timezone);

  const isDay = localHour >= 5 && localHour < 19;

  const { text, emoji } = describeWeather(current.weathercode, isDay);
  const textColor = isDay ? theme.text : "#F1F5F9";

  return (
    <div
      className="wcard"
      style={{
        background: isDay
          ? theme.bg
          : `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), ${theme.bg}`,
        boxShadow: `0 4px 24px ${theme.accent}44`,
        color: isDay ? theme.text : "#F1F5F9",
      }}
    >
      <div className="wcard-title">Weather Summary</div>
      <div className="wcard-main">
        <div className="wicon" style={{ fontSize: "7rem" }}>
          {emoji}
        </div>
        <div>
          <div className="wtemp">{Math.round(current.temperature_2m)}°C</div>
            <div
            className="wcond glass"
            style={{
            
              WebkitBackgroundClip: "text",
              
            }}
          >
            {text}
          </div>

          <div className="wdesc">
            Feels like{" "}
            {Math.round(current.apparent_temperature ?? current.temperature_2m)}
            °
          </div>
        </div>
      </div>
    </div>
  );
}
function getLocalHourInTz(timezone) {
  try {
    return Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
    );
  } catch {
    return new Date().getHours();
  }
}
