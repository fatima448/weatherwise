// src/components/CitySearch.jsx
import { useState } from "react";
import { searchCity } from "../services/weather";

export default function CitySearch({ onCityChange, toast }) {
  const [input, setInput]         = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError]         = useState("");

  const handleSearch = async () => {
    const trimmed = input.trim(); // ← fix: strip leading/trailing spaces
    if (!trimmed) return;
    setSearching(true);
    setError("");
    try {
      const result = await searchCity(trimmed); // ← use trimmed, not raw input
      onCityChange(result);
      setInput("");
    } catch {
      setError("City not found. Try another name.");
    }
    setSearching(false);
  };

  return (
    <div className="city-search">
      <div className="city-search-row">
        <input
          className="city-input"
          type="text"
          placeholder="Search city…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button className="city-btn" onClick={handleSearch} disabled={searching}>
          {searching ? "…" : "🔍"}
        </button>
      </div>
      {error && <div className="city-error">{error}</div>}
    </div>
  );
}