import { useEffect, useMemo, useState } from "react";
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

const MOOD = [
    { value: 1, emoji: "😢", label: "Өте ауыр", color: "#ef5350", bg: "#ffebee" },
    { value: 2, emoji: "😟", label: "Қиындау",  color: "#ff7043", bg: "#fbe9e7" },
    { value: 3, emoji: "😐", label: "Жай",      color: "#ffa726", bg: "#fff8e1" },
    { value: 4, emoji: "🙂", label: "Жақсы",    color: "#66bb6a", bg: "#e8f5e9" },
    { value: 5, emoji: "😊", label: "Тамаша",   color: "#26a69a", bg: "#e0f2f1" },
];

const PROMPTS = [
    "Бүгін мені ойлантқан нәрсе...",
    "Маған күш беріп тұрған нәрсе...",
    "Бүгін не үшін ризамын...",
    "Менің арманым...",
];

function getGreeting() {
    const h = new Date().getHours();
    if (h < 6)  return { text: "Түнгі ойларыңызды жазып қалдырыңыз", icon: "🌙" };
    if (h < 12) return { text: "Қайырлы таң! Бүгінгі күйіңіз қандай?", icon: "☀️" };
    if (h < 18) return { text: "Қайырлы күн! Ойларыңызды бөлісіңіз", icon: "🌤️" };
    return { text: "Қайырлы кеш! Бүгінгі күнді қорытыңыз", icon: "🌅" };
}

export default function Diary() {
    const [mood, setMood] = useState(0);
    const [text, setText] = useState("");
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [viewMonth, setViewMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [showAll, setShowAll] = useState(false);

    const greeting = useMemo(getGreeting, []);

    const currentRole = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        const p = parseJwt(t);
        return (p?.role || "patient").toLowerCase();
    }, []);
    const canSeeAi = currentRole === "psychologist" || currentRole === "admin" || currentRole === "super_admin";

    useEffect(() => {
        let off = false;
        (async () => {
            setLoading(true);
            try {
                const [list, sum] = await Promise.all([
                    api("/api/v1/diary?limit=365", { auth: true }),
                    api("/api/v1/diary/summary", { auth: true }),
                ]);
                if (!off) { setEntries(Array.isArray(list) ? list : []); setSummary(sum || null); }
            } catch (e) { if (!off) setError(e.message || "Жүктеу қатесі"); }
            finally { if (!off) setLoading(false); }
        })();
        return () => { off = true; };
    }, []);

    const entryDates = useMemo(() => {
        const m = new Map();
        for (const e of entries) {
            const d = new Date(e.created_at);
            if (!isNaN(d)) {
                const k = dk(d);
                if (!m.has(k)) m.set(k, e.mood);
            }
        }
        return m;
    }, [entries]);

    const streak = useMemo(() => {
        let c = 0;
        const today = new Date(); today.setHours(0,0,0,0);
        for (let i = 0; i < 365; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            if (entryDates.has(dk(d))) c++;
            else { if (i === 0) continue; break; }
        }
        return c;
    }, [entryDates]);

    const totalEntries = entries.length;
    const visibleEntries = useMemo(() => showAll ? entries.slice(0, 50) : entries.slice(0, 6), [entries, showAll]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError(""); setSuccess("");
        if (!mood) { setError("Көңіл-күйіңізді таңдаңыз 👆"); return; }
        setSaving(true);
        try {
            const entry = await api("/api/v1/diary", { method: "POST", auth: true, body: { mood, text: text.trim() } });
            setEntries((prev) => [entry, ...prev]);
            setSummary((prev) => {
                if (!prev || !prev.count) return { count: 1, avg_mood: mood, first_mood: mood, latest_mood: mood };
                const nc = prev.count + 1;
                return { ...prev, count: nc, avg_mood: (prev.avg_mood * prev.count + mood) / nc, latest_mood: mood };
            });
            setText(""); setMood(0);
            setSuccess("Жазба сақталды ✨ Рахмет, бүгін де жаздыңыз!");
            setTimeout(() => setSuccess(""), 5000);
        } catch (err) { setError(err.message || "Сақтау қатесі"); }
        finally { setSaving(false); }
    }

    const selectedMood = MOOD.find((m) => m.value === mood);

    return (
        <div style={S.page}>
            {/* ===== TOP: greeting + streak ===== */}
            <div style={S.topBar}>
                <div>
                    <h1 style={S.title}>
                        <span style={{ marginRight: 8 }}>{greeting.icon}</span>
                        Менің күнделігім
                    </h1>
                    <p style={S.greet}>{greeting.text}</p>
                </div>
                <div style={S.topRight}>
                    {streak > 0 && (
                        <div style={S.streak}>
                            <span style={S.streakFire}>🔥</span>
                            <span style={S.streakN}>{streak}</span>
                            <span style={S.streakTxt}>күн{streak > 1 ? "" : ""}</span>
                        </div>
                    )}
                    <div style={S.totalBadge}>
                        📝 {totalEntries} жазба
                    </div>
                </div>
            </div>

            {/* ===== MAIN GRID: form + calendar ===== */}
            <div style={S.grid}>
                {/* LEFT — write */}
                <div style={S.left}>
                    <div style={{
                        ...S.formCard,
                        borderColor: selectedMood ? selectedMood.color + "55" : "#e8e8e8",
                        background: selectedMood ? selectedMood.bg : "#fff",
                    }}>
                        <h2 style={S.formTitle}>Бүгінгі жазба ✍️</h2>

                        <form onSubmit={handleSubmit}>
                            {/* Mood */}
                            <p style={S.label}>Қалыңыз қалай?</p>
                            <div style={S.moodRow}>
                                {MOOD.map((m) => (
                                    <button
                                        key={m.value}
                                        type="button"
                                        onClick={() => setMood(m.value)}
                                        style={{
                                            ...S.moodBtn,
                                            background: mood === m.value ? m.color : "#f8f8f8",
                                            color: mood === m.value ? "#fff" : "#666",
                                            borderColor: mood === m.value ? m.color : "#e4e4e4",
                                            boxShadow: mood === m.value ? `0 4px 16px ${m.color}44` : "none",
                                            transform: mood === m.value ? "translateY(-2px) scale(1.05)" : "scale(1)",
                                        }}
                                    >
                                        <span style={{ fontSize: 22 }}>{m.emoji}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Prompts */}
                            <div style={S.prompts}>
                                {PROMPTS.map((p) => (
                                    <button
                                        key={p} type="button" style={S.chip}
                                        onClick={() => { if (!text.includes(p)) setText((v) => (v ? v + "\n" + p + " " : p + " ")); }}
                                    >
                                        💬 {p}
                                    </button>
                                ))}
                            </div>

                            {/* Textarea */}
                            <textarea
                                style={S.textarea}
                                rows={6}
                                placeholder="Ойыңызды, сезіміңізді еркін жазыңыз...&#10;Тек көңіл-күй таңдау да жеткілікті 🤍"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />

                            {error && <div style={S.errBox}>{error}</div>}
                            {success && <div style={S.okBox}>{success}</div>}

                            <button type="submit" disabled={saving} className="btn" style={S.submit}>
                                {saving ? "Сақталуда..." : "Жазбаны сақтау 📖"}
                            </button>
                        </form>
                    </div>
                </div>

                {/* RIGHT — calendar + stats */}
                <div style={S.right}>
                    <MiniCalendar
                        year={viewMonth.year} month={viewMonth.month}
                        entryDates={entryDates}
                        onChange={(y, m) => setViewMonth({ year: y, month: m })}
                    />

                

                    {/* Motivation quote */}
                    <div style={S.quoteCard}>
                        <span style={{ fontSize: 20 }}>🌱</span>
                        <p style={S.quoteText}>
                            Күн сайын жазу — өзіңізге деген ең үлкен қамқорлық.
                            Бір сөйлем де жеткілікті.
                        </p>
                    </div>
                </div>
            </div>

            {/* ===== HISTORY ===== */}
            <div style={S.historyBlock}>
                <div style={S.historyHead}>
                    <h2 style={S.historyTitle}>Соңғы жазбалар</h2>
                    {totalEntries > 6 && (
                        <button type="button" style={S.toggleBtn} onClick={() => setShowAll(!showAll)}>
                            {showAll ? "Жасыру" : `Барлығын көру (${totalEntries})`}
                        </button>
                    )}
                </div>

                {loading && <p style={S.muted}>Жүктелуде…</p>}
                {!loading && entries.length === 0 && (
                    <div style={S.emptyState}>
                        <span style={{ fontSize: 40 }}>📔</span>
                        <p style={{ color: "#777", margin: "12px 0 0", fontSize: 15 }}>
                            Әлі жазба жоқ. Бүгін бастаңыз — бір ой да жеткілікті!
                        </p>
                    </div>
                )}
                {!loading && visibleEntries.length > 0 && (
                    <div style={S.entriesGrid}>
                        {visibleEntries.map((entry) => (
                            <EntryCard key={entry.id} entry={entry} canSeeAi={canSeeAi} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* =========== Mini Calendar =========== */

const MO = ["Қаң","Ақп","Нау","Сәу","Мам","Мау","Шіл","Там","Қыр","Қаз","Қар","Жел"];
const DN = ["Дс","Сс","Ср","Бс","Жм","Сб","Жс"];

function MiniCalendar({ year, month, entryDates, onChange }) {
    const todayKey = dk(new Date());
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    let off = first.getDay() - 1; if (off < 0) off = 6;

    const cells = [];
    for (let i = 0; i < off; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);

    const prev = () => onChange(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
    const next = () => onChange(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);

    return (
        <div style={S.cal}>
            <div style={S.calHead}>
                <button type="button" onClick={prev} style={S.calArrow}>‹</button>
                <span style={S.calLabel}>{MO[month]} {year}</span>
                <button type="button" onClick={next} style={S.calArrow}>›</button>
            </div>
            <div style={S.calDN}>
                {DN.map((d) => <div key={d} style={S.calDNCell}>{d}</div>)}
            </div>
            <div style={S.calGrid}>
                {cells.map((day, i) => {
                    if (day === null) return <div key={`e${i}`} style={S.calCell} />;
                    const key = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const moodVal = entryDates.get(key);
                    const has = moodVal !== undefined;
                    const isToday = key === todayKey;
                    const mColor = has ? (MOOD.find((m) => m.value === moodVal)?.color || "#12bfae") : "transparent";

                    return (
                        <div key={key} style={{
                            ...S.calCell,
                            background: has ? mColor : isToday ? "#f0faf9" : "transparent",
                            color: has ? "#fff" : isToday ? "#12bfae" : "#555",
                            fontWeight: has || isToday ? 700 : 400,
                            border: isToday && !has ? "1.5px solid #12bfae" : "1.5px solid transparent",
                            borderRadius: 8,
                        }}>
                            {day}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* =========== Entry Card =========== */

function EntryCard({ entry, canSeeAi }) {
    const d = new Date(entry.created_at);
    const m = MOOD.find((o) => o.value === entry.mood);

    const keySignals = canSeeAi && entry.ai_key_signals ? parseSignals(entry.ai_key_signals) : [];

    return (
        <div style={{ ...S.eCard, borderLeftColor: m?.color || "#e0e0e0" }}>
            <div style={S.eTop}>
                <span style={S.eDate}>
                    {d.toLocaleDateString("kk-KZ", { day: "numeric", month: "short" })}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {m && <span style={{ fontSize: 18 }} title={m.label}>{m.emoji}</span>}
                    {canSeeAi && typeof entry.ai_score === "number" && (
                        <span style={{
                            ...S.aiBadge,
                            background: entry.ai_zone === "red" ? "#c62828" : entry.ai_zone === "yellow" ? "#f9a825" : "#2e7d32",
                        }}>{entry.ai_score}</span>
                    )}
                </div>
            </div>
            {entry.text && <p style={S.eText}>{entry.text}</p>}
            {!entry.text && <p style={{ ...S.eText, color: "#aaa", fontStyle: "italic" }}>Тек көңіл-күй белгіленді</p>}

            {canSeeAi && entry.ai_reasoning && (
                <div style={S.aiBlock}>
                    <div style={S.aiBlockHead}>
                        <span style={S.aiBlockIcon}>AI</span>
                        <span style={S.aiBlockTitle}>Түсіндірме</span>
                    </div>
                    <p style={S.aiReasoning}>{entry.ai_reasoning}</p>
                    {keySignals.length > 0 && (
                        <div style={S.signalsRow}>
                            {keySignals.map((s, i) => (
                                <span key={i} style={S.signalTag}>{s}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function parseSignals(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
        try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch {}
    }
    return [];
}

/* =========== Helpers =========== */

function SumItem({ label, value, emoji }) {
    return (
        <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 18 }}>{emoji}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#333" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#999" }}>{label}</div>
        </div>
    );
}

function dk(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function moodEmoji(val) {
    if (!val || val <= 0) return "—";
    const rounded = Math.round(val);
    return MOOD.find((m) => m.value === rounded)?.emoji || "😐";
}

/* =========== Styles =========== */

const S = {
    page: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 60px" },

    topBar: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 },
    title: { fontSize: 26, fontWeight: 800, margin: 0, color: "#1a1a1a", display: "flex", alignItems: "center" },
    greet: { fontSize: 15, color: "#777", margin: "4px 0 0" },
    topRight: { display: "flex", alignItems: "center", gap: 12 },
    streak: { display: "flex", alignItems: "center", gap: 5, background: "linear-gradient(135deg,#fff5f5,#fff0e0)", border: "1px solid #ffccbc", borderRadius: 12, padding: "8px 14px" },
    streakFire: { fontSize: 20 },
    streakN: { fontSize: 20, fontWeight: 800, color: "#e65100" },
    streakTxt: { fontSize: 12, color: "#bf360c" },
    totalBadge: { background: "#f5f5f5", border: "1px solid #e0e0e0", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#555" },

    grid: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" },
    left: { minWidth: 0 },
    right: { display: "flex", flexDirection: "column", gap: 16 },

    formCard: { borderRadius: 20, border: "1.5px solid #e8e8e8", padding: "24px 24px 20px", transition: "all 0.3s", boxShadow: "0 2px 16px rgba(0,0,0,0.04)" },
    formTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 16px", color: "#222" },
    label: { fontSize: 14, fontWeight: 600, color: "#444", margin: "0 0 10px" },
    moodRow: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 },
    moodBtn: {
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        border: "1.5px solid #e4e4e4", borderRadius: 14, padding: "10px 14px", minWidth: 72,
        cursor: "pointer", transition: "all 0.2s", background: "#f8f8f8",
    },
    prompts: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    chip: { border: "1px solid #e8e8e8", borderRadius: 999, padding: "6px 12px", fontSize: 12, color: "#666", background: "#fafafa", cursor: "pointer", transition: "all 0.15s" },
    textarea: { width: "100%", borderRadius: 16, border: "1px solid #ddd", padding: "14px 16px", fontSize: 15, lineHeight: 1.6, resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "rgba(255,255,255,0.7)", minHeight: 120 },
    errBox: { marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#ffebee", color: "#c62828", fontSize: 13 },
    okBox: { marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#e0f7f4", color: "#00796b", fontSize: 13 },
    submit: { marginTop: 14, minWidth: 180, fontSize: 15 },

    // Calendar (small, right side)
    cal: { background: "#fff", borderRadius: 16, border: "1px solid #eee", padding: "16px 14px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" },
    calHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    calArrow: { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#12bfae", padding: "2px 8px", borderRadius: 6 },
    calLabel: { fontSize: 14, fontWeight: 700, color: "#333" },
    calDN: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 },
    calDNCell: { textAlign: "center", fontSize: 10, fontWeight: 600, color: "#aaa", padding: "2px 0" },
    calGrid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 },
    calCell: { display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "1", fontSize: 12, borderRadius: 8, cursor: "default", transition: "all 0.15s" },

    summaryCard: { background: "#fff", borderRadius: 14, border: "1px solid #eee", padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.03)" },
    summaryTitle: { fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 10, textAlign: "center" },
    summaryRow: { display: "flex", gap: 4 },

    quoteCard: { background: "linear-gradient(135deg,#f0faf9,#e8f5e9)", borderRadius: 14, padding: "16px 14px", display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid #c8e6c9" },
    quoteText: { margin: 0, fontSize: 13, lineHeight: 1.5, color: "#555" },

    historyBlock: { marginTop: 36 },
    historyHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    historyTitle: { fontSize: 18, fontWeight: 700, color: "#222", margin: 0 },
    toggleBtn: { border: "none", background: "transparent", color: "#12bfae", fontWeight: 700, cursor: "pointer", fontSize: 13 },
    muted: { color: "#999", fontSize: 14 },
    emptyState: { textAlign: "center", padding: "40px 0" },
    entriesGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 },

    eCard: { background: "#fff", borderRadius: 14, border: "1px solid #eee", borderLeft: "4px solid #e0e0e0", padding: "14px 16px", transition: "box-shadow 0.15s" },
    eTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
    eDate: { fontSize: 12, color: "#999", fontWeight: 500 },
    eText: { margin: 0, fontSize: 14, lineHeight: 1.55, color: "#333", whiteSpace: "pre-wrap" },
    aiBadge: { padding: "2px 7px", borderRadius: 999, color: "#fff", fontSize: 10, fontWeight: 700 },

    aiBlock: { marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" },
    aiBlockHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 6 },
    aiBlockIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, background: "#0f172a", color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.03em" },
    aiBlockTitle: { fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" },
    aiReasoning: { margin: 0, fontSize: 13, lineHeight: 1.55, color: "#334155" },
    signalsRow: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 },
    signalTag: { padding: "2px 8px", borderRadius: 5, background: "#e2e8f0", color: "#475569", fontSize: 11, fontWeight: 500 },
};
