// src/components/WeatherChat.jsx
import { useState, useRef, useEffect } from "react";
import { chatWithAssistant } from "../services/gemini";

const QUICK_PROMPTS = [
  "Any conflicts with my tasks today?",
  "Best time for outdoor activities?",
  "What should I wear today?",
  "Give me a quick weather summary",
];

export default function WeatherChat({ tasks, weather }) {
  const [messages, setMessages] = useState([
    {
      role: "model",
      text: "Hey! I can see your tasks and today's forecast. Ask me anything — conflicts, best times, what to wear, or anything else.",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const textareaRef           = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: "user", text: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setLoading(true);

    // Build Gemini-format history (role must be "user" or "model")
    const history = nextMessages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    try {
      const reply = await chatWithAssistant(history, tasks, weather);
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Connection error — check your Gemini API key in .env" },
      ]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  return (
    <div className="wchat">
      <div className="wchat-header">
        <span className="wchat-icon">🤖</span>
        <span className="wchat-title">Ask WeatherWise</span>
        <span className="wchat-dot" />
      </div>

      <div className="wchat-msgs" id="wchat-msgs">
        {messages.map((m, i) => (
          <div key={i} className={`wchat-msg ${m.role === "user" ? "user" : "bot"}`}>
            {m.role !== "user" && <div className="wchat-avatar">W</div>}
            <div className="wchat-bubble">{m.text}</div>
          </div>
        ))}

        {loading && (
          <div className="wchat-msg bot">
            <div className="wchat-avatar">W</div>
            <div className="wchat-bubble wchat-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick-prompt chips — hide after first user message */}
      {messages.filter((m) => m.role === "user").length === 0 && (
        <div className="wchat-chips">
          {QUICK_PROMPTS.map((q, i) => (
            <button key={i} className="wchat-chip" onClick={() => send(q)}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="wchat-input-row">
        <textarea
          ref={textareaRef}
          className="wchat-input"
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="Ask about your tasks or weather…"
          rows={1}
        />
        <button
          className="wchat-send"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
