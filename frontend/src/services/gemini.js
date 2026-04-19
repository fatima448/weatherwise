// src/services/gemini.js
// All Gemini 2.0 Flash calls live here — one place to update the key

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function callGemini(systemPrompt, userPrompt, maxTokens = 400) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Gemini API error");
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function parseJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ── 1. Classify a task + check weather conflict ───────────────────────────
// Called when user adds a new task in ReschedulePanel
export async function classifyTaskConflict(taskName, hour, forecast) {
  const system = `You are a weather-aware task classifier. 
Always respond with valid JSON only — no markdown, no explanation.`;

  const user = `Task: "${taskName}"
Scheduled time: ${hour}:00
Forecast at that hour:
- Rain chance: ${forecast?.precipitation_probability ?? 0}%
- Wind: ${forecast?.windspeed ?? 0} km/h
- Weather code: ${forecast?.weathercode ?? 0} (51-67=rain, 71-77=snow, 95-99=storm)
- Temperature: ${forecast?.temperature ?? 20}°C

Respond ONLY with this JSON:
{
  "isOutdoor": true or false,
  "hasConflict": true or false,
  "conflictReason": "one short sentence, or null",
  "suggestedFix": "one short suggestion, or null",
  "emoji": "one relevant emoji for this task"
}`;

  const text = await callGemini(system, user, 150);
  return parseJSON(text);
}

// ── 2. Generate dynamic insights ─────────────────────────────────────────
// Called once when ReschedulePanel mounts with real weather data
export async function generateInsights(weather, tasks) {
  const current = weather?.current ?? {};
  const conflicts = tasks.filter((t) => t.conflict).map((t) => t.label);

  const system = `You are a friendly personal weather advisor — like a friend who checked the weather for you.
Always respond with valid JSON only — no markdown, no explanation.`;

  const user = `Today's weather:
- Temperature: ${current.temperature_2m ?? "?"}°C
- Feels like: ${current.apparent_temperature ?? "?"}°C
- Humidity: ${current.relative_humidity_2m ?? "?"}%
- Wind: ${current.wind_speed_10m ?? "?"} km/h
- UV index: ${current.uv_index ?? "?"}
- Weather code: ${current.weathercode ?? 0}

Tasks with weather conflicts: ${conflicts.length ? conflicts.join(", ") : "none"}

Write exactly 3 short insights. Rules:
- Sound like a friend texting you, not a weather app
- Be specific to the actual numbers above (mention actual temp, wind, etc.)
- Each must be genuinely different — no two about the same topic
- Do NOT just say "bring umbrella" or "wear sunscreen" — say something smarter

Respond ONLY with this JSON array:
[
  { "icon": "emoji", "body": "insight text (max 12 words)" },
  { "icon": "emoji", "body": "insight text (max 12 words)" },
  { "icon": "emoji", "body": "insight text (max 12 words)" }
]`;

  const text = await callGemini(system, user, 250);
  return parseJSON(text);
}

// ── 3. Multi-turn chat ────────────────────────────────────────────────────
// Called by WeatherChat for each user message
// history = [{ role: "user"|"model", parts: [{ text }] }]
export async function chatWithAssistant(history, tasks, weather) {
  const current = weather?.current ?? {};
  const conflicts = tasks
    .filter((t) => t.conflict)
    .map((t) => `${t.label} at ${t.time} (${t.conflictReason})`);

  const system = `You are WeatherWise Assistant — a concise, friendly weather & task advisor inside a weather app.

User's tasks today:
${tasks.map((t) => `- ${t.label} at ${t.time}${t.conflict ? " ⚠️ CONFLICT: " + t.conflictReason : " ✅"}`).join("\n")}

Current weather:
- ${current.temperature_2m}°C, feels like ${current.apparent_temperature}°C
- Humidity: ${current.relative_humidity_2m}%, Wind: ${current.wind_speed_10m} km/h
- UV: ${current.uv_index}, Weather code: ${current.weathercode}
${conflicts.length ? `\nConflicting tasks: ${conflicts.join("; ")}` : ""}

Rules:
- Be warm and conversational, NOT robotic
- Keep replies to 2-3 sentences max
- If asked about a task, check its conflict status above
- Give specific time-based advice when possible
- Never start with "Certainly!" or "Great question!"`;

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: history,
      generationConfig: { maxOutputTokens: 200, temperature: 0.8 },
    }),
  });

  if (!res.ok) throw new Error("Gemini chat error");
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't respond right now.";
}
