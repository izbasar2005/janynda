import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

function parseJwt(t) {
  try {
    const base = t.split(".")[1];
    const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function zoneClass(zone) {
  const z = (zone || "").toLowerCase();
  if (z === "red") return "admin-ai-zone admin-ai-zone--red";
  if (z === "yellow") return "admin-ai-zone admin-ai-zone--yellow";
  if (z === "green") return "admin-ai-zone admin-ai-zone--green";
  return "admin-ai-zone";
}

export default function AdminAiTest() {
  const nav = useNavigate();
  const [text, setText] = useState("Маған өте қиын. Ұйқым бұзылды, үнемі уайымдаймын.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const role = useMemo(() => (parseJwt(token() || "")?.role || "").toLowerCase(), []);

  useEffect(() => {
    const t = token();
    if (!t) {
      nav("/login");
      return;
    }
    if (role !== "admin" && role !== "super_admin") {
      setError("Бұл бет тек админ немесе сүпер админ үшін.");
    }
  }, [nav, role]);

  async function runTest() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api("/api/v1/ai/test", {
        method: "POST",
        auth: true,
        body: { text: text.trim() },
      });
      setResult(data?.assessment || data);
    } catch (e) {
      try {
        const parsed = JSON.parse(e.message);
        setError(parsed.details ? `${parsed.error}: ${parsed.details}` : (parsed.error || e.message));
      } catch {
        setError(e.message || "Қате");
      }
    } finally {
      setLoading(false);
    }
  }

  const canRun = role === "admin" || role === "super_admin";

  return (
    <div className="page admin-ai-test-page">
      <div className="page-header">
        <div>
          <h2 className="page-header__title">AI тексеру</h2>
          <p className="muted page-header__subtitle">
            Anthropic/Claude жұмысын тез тексеру (dev/debug үшін).
          </p>
        </div>
      </div>

      {error && <div className="admin-banner admin-banner--error">{error}</div>}

      <div className="card admin-ai-card">
        <label className="admin-ai-card__label" htmlFor="admin-ai-text">
          Тест мәтіні
        </label>
        <textarea
          id="admin-ai-text"
          className="admin-ai-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Мәтін енгізіңіз…"
        />

        <div className="admin-ai-actions">
          <button
            type="button"
            className="btn"
            onClick={runTest}
            disabled={loading || !text.trim() || !canRun}
          >
            {loading ? "Тексерілуде…" : "Проверить AI"}
          </button>
          <span className="admin-ai-hint">Нәтиже: score / zone / reasoning бірден шығады.</span>
        </div>

        {result && (
          <div className="admin-ai-result">
            <div className="admin-ai-result__row">
              <span className="admin-ai-result__k">Score</span>
              <span className="admin-ai-result__v">{result.score}</span>
            </div>
            <div className="admin-ai-result__row">
              <span className="admin-ai-result__k">Zone</span>
              <span className={zoneClass(result.zone)}>{result.zone}</span>
            </div>
            <div>
              <span className="admin-ai-result__k">Key signals</span>
              <ul className="admin-ai-signals">
                {(result.key_signals || []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="admin-ai-result__k">Reasoning</span>
              <div className="admin-ai-reasoning">{result.reasoning}</div>
            </div>
            <div className="admin-ai-result__row">
              <span className="admin-ai-result__k">Urgent</span>
              <span className="admin-ai-result__v">{String(!!result.urgent)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
