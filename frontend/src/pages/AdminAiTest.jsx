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

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>AI тексеру</h1>
        <p style={S.subtitle}>Anthropic/Claude жұмысын тез тексеру (dev/debug үшін).</p>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      <div style={S.card}>
        <label style={S.label}>Тест мәтіні</label>
        <textarea
          style={S.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Мәтін енгізіңіз…"
        />

        <div style={S.actions}>
          <button
            type="button"
            onClick={runTest}
            disabled={loading || !text.trim() || (role !== "admin" && role !== "super_admin")}
            style={loading ? { ...S.btn, opacity: 0.7 } : S.btn}
          >
            {loading ? "Тексерілуде…" : "Проверить AI"}
          </button>
          <span style={S.hint}>
            Нәтиже: score/zone/reasoning бірден шығады.
          </span>
        </div>

        {result && (
          <div style={S.result}>
            <div style={S.resultRow}>
              <span style={S.k}>Score</span>
              <span style={S.v}>{result.score}</span>
            </div>
            <div style={S.resultRow}>
              <span style={S.k}>Zone</span>
              <span style={{ ...S.v, ...zoneStyle(result.zone) }}>{result.zone}</span>
            </div>
            <div style={S.resultRowCol}>
              <span style={S.k}>Key signals</span>
              <ul style={S.ul}>
                {(result.key_signals || []).map((s, i) => (
                  <li key={i} style={S.li}>{s}</li>
                ))}
              </ul>
            </div>
            <div style={S.resultRowCol}>
              <span style={S.k}>Reasoning</span>
              <div style={S.reasoning}>{result.reasoning}</div>
            </div>
            <div style={S.resultRow}>
              <span style={S.k}>Urgent</span>
              <span style={S.v}>{String(!!result.urgent)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function zoneStyle(zone) {
  const z = (zone || "").toLowerCase();
  if (z === "red") return { background: "#fef2f2", color: "#dc2626", padding: "2px 10px", borderRadius: 999, fontWeight: 700 };
  if (z === "yellow") return { background: "#fffbeb", color: "#d97706", padding: "2px 10px", borderRadius: 999, fontWeight: 700 };
  if (z === "green") return { background: "#f0fdf4", color: "#059669", padding: "2px 10px", borderRadius: 999, fontWeight: 700 };
  return {};
}

const S = {
  page: { maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" },
  header: { marginBottom: 18 },
  title: { fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
  errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "12px 16px", fontWeight: 700, fontSize: 14, marginBottom: 14 },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 18px" },
  label: { display: "block", fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 8 },
  textarea: { width: "100%", borderRadius: 12, border: "1px solid #cbd5e1", padding: "12px 14px", fontSize: 14, boxSizing: "border-box", resize: "vertical" },
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" },
  btn: { border: "none", borderRadius: 10, background: "#0f172a", color: "#fff", fontWeight: 700, padding: "10px 16px", cursor: "pointer" },
  hint: { fontSize: 13, color: "#64748b" },
  result: { marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 },
  resultRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  resultRowCol: { display: "flex", flexDirection: "column", gap: 6 },
  k: { fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" },
  v: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  ul: { margin: 0, paddingLeft: 18, color: "#334155" },
  li: { marginBottom: 4, fontSize: 14 },
  reasoning: { fontSize: 14, color: "#334155", lineHeight: 1.5, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 12px" },
};

