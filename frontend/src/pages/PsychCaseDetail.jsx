import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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

const MOOD_OPTIONS = [
    { value: 1, emoji: "😢", label: "Өте ауыр" },
    { value: 2, emoji: "😟", label: "Қиындау" },
    { value: 3, emoji: "😐", label: "Жай" },
    { value: 4, emoji: "🙂", label: "Жақсы" },
    { value: 5, emoji: "😊", label: "Жақсырақ" },
];

const STATUS_LABELS = {
    open: "Ашық",
    in_review: "Қаралуда",
    resolved: "Шешілді",
    escalated: "Күшейтілді",
};
const STATUS_COLORS = {
    open: { bg: "#eff6ff", color: "#1d4ed8" },
    in_review: { bg: "#fefce8", color: "#a16207" },
    resolved: { bg: "#f0fdf4", color: "#15803d" },
    escalated: { bg: "#fef2f2", color: "#b91c1c" },
};

export default function PsychCaseDetail() {
    const { id } = useParams();
    const nav = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [score, setScore] = useState("");
    const [note, setNote] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [psychologists, setPsychologists] = useState([]);
    const [selectedPsychId, setSelectedPsychId] = useState("");

    const role = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        return (parseJwt(t)?.role || "").toLowerCase();
    }, []);

    useEffect(() => {
        if (!token()) { nav("/login"); return; }
        if (role !== "psychologist" && role !== "admin" && role !== "super_admin") {
            setError("Рұқсат жоқ.");
            setLoading(false);
            return;
        }

        setLoading(true);
        const promises = [api(`/api/v1/psych/cases/${id}`, { auth: true })];
        if (role === "admin" || role === "super_admin") {
            promises.push(
                api("/api/v1/admin/users", { auth: true })
                    .then((users) => (Array.isArray(users) ? users : []).filter((u) => u.role === "psychologist"))
                    .catch(() => [])
            );
        }
        Promise.all(promises)
            .then(([data, psychList]) => {
                setCaseData(data);
                if (data.psych_score != null) setScore(String(data.psych_score));
                if (data.psych_note) setNote(data.psych_note);
                if (psychList) setPsychologists(psychList);
            })
            .catch((e) => setError(e.message || "Қате"))
            .finally(() => setLoading(false));
    }, [id, nav, role]);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitMsg("");
        const s = parseInt(score, 10);
        if (isNaN(s) || s < 0 || s > 100) {
            setSubmitMsg("Балл 0-ден 100-ге дейін болуы керек.");
            return;
        }
        setSubmitting(true);
        try {
            const updated = await api(`/api/v1/psych/cases/${id}`, {
                method: "PATCH",
                auth: true,
                body: { score: s, note: note.trim() },
            });
            setCaseData((prev) => ({ ...prev, ...updated }));
            setSubmitMsg("Сәтті сақталды!");
        } catch (err) {
            setSubmitMsg(err.message || "Қате");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleAssign(psychId) {
        setAssigning(true);
        setSubmitMsg("");
        try {
            const body = psychId ? { psychologist_id: psychId } : {};
            await api(`/api/v1/psych/cases/${id}/assign`, { method: "POST", auth: true, body });
            const full = await api(`/api/v1/psych/cases/${id}`, { auth: true });
            setCaseData(full);
            setSubmitMsg("Психолог тағайындалды!");
            setTimeout(() => setSubmitMsg(""), 3000);
        } catch (err) {
            setSubmitMsg(err.message || "Қате");
        } finally {
            setAssigning(false);
        }
    }

    if (loading) {
        return <div style={S.page}><p style={S.muted}>Жүктелуде…</p></div>;
    }
    if (error) {
        return (
            <div style={S.page}>
                <div style={S.errorBanner}>{error}</div>
                <Link to="/psych" style={S.backLink}>← Кейстер тізіміне қайту</Link>
            </div>
        );
    }
    if (!caseData) return null;

    const isRed = caseData.zone === "red";
    const isYellow = caseData.zone === "yellow";
    const isResolved = caseData.status === "resolved";
    const isRedUnassigned = isRed && !caseData.psychologist_id && role === "psychologist";
    const isAdminCanAssign = !caseData.psychologist_id && (role === "admin" || role === "super_admin");
    const isMine = caseData.is_mine === true;
    const isChat = caseData.source_type === "chat";
    const d = new Date(caseData.created_at);
    const sc = STATUS_COLORS[caseData.status] || STATUS_COLORS.open;

    return (
        <div style={S.page}>
            <Link to="/psych" style={S.backLink}>← Кейстер тізіміне қайту</Link>

            {/* ——— Header bar ——— */}
            <div style={{ ...S.card, borderLeft: `3px solid ${isRed ? "#dc2626" : "#d97706"}` }}>
                <div style={S.headerRow}>
                    <div>
                        <div style={S.caseTitle}>Кейс #{caseData.id}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ ...S.badge, background: isRed ? "#fef2f2" : "#fffbeb", color: isRed ? "#dc2626" : "#d97706" }}>
                                {isRed ? "Қызыл зона" : "Сары зона"}
                            </span>
                            <span style={{ ...S.badge, background: sc.bg, color: sc.color }}>
                                {STATUS_LABELS[caseData.status]}
                            </span>
                            <span style={{ ...S.badge, background: isChat ? "#ede9fe" : "#ecfdf5", color: isChat ? "#6d28d9" : "#047857" }}>
                                {isChat ? "Чат" : "Күнделік"}
                            </span>
                            {isMine && <span style={{ ...S.badge, background: "#eff6ff", color: "#2563eb" }}>Менікі</span>}
                        </div>
                    </div>
                    <div style={S.headerRight}>
                        <div style={S.metaItem}>
                            <span style={S.metaLabel}>AI балл</span>
                            <span style={{ ...S.metaValue, color: isRed ? "#dc2626" : "#d97706" }}>{caseData.ai_score}</span>
                        </div>
                        {caseData.psych_score != null && (
                            <div style={S.metaItem}>
                                <span style={S.metaLabel}>Психолог бағасы</span>
                                <span style={{ ...S.metaValue, color: "#7c3aed" }}>{caseData.psych_score}</span>
                            </div>
                        )}
                        <div style={S.metaItem}>
                            <span style={S.metaLabel}>Күні</span>
                            <span style={S.metaValue}>
                                {d.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ——— Assignment ——— */}
            {caseData.psychologist_id && (
                <div style={{ ...S.notice, background: "#f8fafc", borderColor: "#e2e8f0" }}>
                    {isMine ? "Бұл кейс сізге тағайындалған" : `Тағайындалған психолог ID: ${caseData.psychologist_id}`}
                </div>
            )}

            {isRedUnassigned && (
                <div style={{ ...S.notice, background: "#fef2f2", borderColor: "#fecaca" }}>
                    <div style={{ flex: 1 }}>
                        <strong style={{ color: "#991b1b" }}>Тағайындалмаған кейс.</strong>
                        <span style={{ color: "#b91c1c", marginLeft: 6 }}>Қабылдағаннан кейін толық деректер ашылады.</span>
                    </div>
                    <button type="button" disabled={assigning} onClick={() => handleAssign(null)} style={S.btnDanger}>
                        {assigning ? "..." : "Кейсті қабылдау"}
                    </button>
                </div>
            )}

            {isAdminCanAssign && (
                <div style={{ ...S.notice, background: "#faf5ff", borderColor: "#e9d5ff" }}>
                    <span style={{ fontWeight: 600, color: "#6d28d9", marginRight: 8 }}>Психолог тағайындау:</span>
                    <select value={selectedPsychId} onChange={(e) => setSelectedPsychId(e.target.value)} style={S.select}>
                        <option value="">— Таңдаңыз —</option>
                        {psychologists.map((p) => (
                            <option key={p.id} value={p.id}>{p.full_name} (ID: {p.id})</option>
                        ))}
                    </select>
                    <button type="button" disabled={assigning || !selectedPsychId} onClick={() => handleAssign(Number(selectedPsychId))} style={S.btnPrimary}>
                        {assigning ? "..." : "Тағайындау"}
                    </button>
                </div>
            )}

            {/* ——— Anonymous text (yellow) ——— */}
            {isYellow && caseData.anonymous_text && (
                <div style={S.card}>
                    <div style={S.sectionTitle}>Анонимді мәтін <span style={S.hint}>(пациент белгісіз)</span></div>
                    <div style={{ ...S.textBlock, background: "#fffbeb", borderColor: "#fde68a" }}>
                        {caseData.anonymous_text}
                    </div>
                </div>
            )}

            {/* ——— Chat AI assessment details ——— */}
            {isChat && caseData.chat_assessment && (
                <div style={S.card}>
                    <div style={S.sectionTitle}>
                        AI чат талдауы
                        <span style={{ ...S.badge, background: "#ede9fe", color: "#6d28d9", marginLeft: 8 }}>
                            {caseData.chat_assessment.msg_count} хабарлама
                        </span>
                        {caseData.chat_assessment.source_type && (
                            <span style={{ ...S.badge, background: "#f1f5f9", color: "#475569", marginLeft: 4 }}>
                                {caseData.chat_assessment.source_type === "group" ? "Топтық чат" : caseData.chat_assessment.source_type === "direct" ? "Жеке чат" : "Аралас"}
                            </span>
                        )}
                    </div>
                    {caseData.chat_assessment.reasoning && (
                        <div style={{ ...S.aiExplain, marginBottom: 10 }}>
                            <div style={S.aiExplainHead}>
                                <span style={S.aiIcon}>AI</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>Түсіндірме</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#334155" }}>
                                {caseData.chat_assessment.reasoning}
                            </p>
                        </div>
                    )}
                    {caseData.chat_assessment.key_signals && (() => {
                        const signals = parseSignals(caseData.chat_assessment.key_signals);
                        return signals.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {signals.map((s, j) => (
                                    <span key={j} style={S.signalChip}>{s}</span>
                                ))}
                            </div>
                        ) : null;
                    })()}
                </div>
            )}

            {/* ——— Patient info (red zone) ——— */}
            {!isYellow && caseData.patient && (
                <div style={{ ...S.card, borderLeft: "3px solid #dc2626" }}>
                    <div style={S.sectionTitle}>Пациент деректері <span style={{ ...S.badge, background: "#fef2f2", color: "#dc2626", marginLeft: 8 }}>Қызыл зона</span></div>
                    <div style={S.fieldGrid}>
                        <Field label="Аты-жөні" value={caseData.patient.full_name} />
                        <Field label="Телефон" value={caseData.patient.phone} />
                        {caseData.patient.iin && <Field label="ЖСН" value={caseData.patient.iin} />}
                        {caseData.patient.gender && <Field label="Жынысы" value={caseData.patient.gender} />}
                    </div>
                </div>
            )}

            {/* ——— Diary entries ——— */}
            {caseData.diary_entries && caseData.diary_entries.length > 0 && (
                <div style={S.card}>
                    <div style={S.sectionTitle}>
                        Күнделік жазбалары
                        <span style={S.countBadge}>{caseData.diary_entries.length}</span>
                    </div>
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                        {caseData.diary_entries.map((entry, i) => {
                            const ed = new Date(entry.created_at);
                            const opt = MOOD_OPTIONS.find((o) => o.value === entry.mood);
                            const signals = parseSignals(entry.ai_key_signals);
                            return (
                                <div key={entry.id || i} style={{ ...S.diaryRow, borderBottom: i < caseData.diary_entries.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                                    <div style={S.diaryTop}>
                                        <span style={{ fontSize: 13, color: "#94a3b8" }}>
                                            {ed.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}
                                        </span>
                                        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            {opt && <span style={{ fontSize: 13 }}>{opt.emoji} {opt.label}</span>}
                                            {typeof entry.ai_score === "number" && (
                                                <span style={{
                                                    padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "#fff",
                                                    background: entry.ai_zone === "red" ? "#dc2626" : entry.ai_zone === "yellow" ? "#d97706" : "#059669",
                                                }}>
                                                    {entry.ai_score}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    {entry.text && <p style={S.diaryText}>{entry.text}</p>}
                                    {entry.ai_reasoning && (
                                        <div style={S.aiExplain}>
                                            <div style={S.aiExplainHead}>
                                                <span style={S.aiIcon}>AI</span>
                                                <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>Түсіндірме</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "#334155" }}>{entry.ai_reasoning}</p>
                                            {signals.length > 0 && (
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                                                    {signals.map((s, j) => (
                                                        <span key={j} style={S.signalChip}>{s}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ——— Review form ——— */}
            {!isResolved && (
                <div style={S.card}>
                    <div style={S.sectionTitle}>Бағалау</div>

                    {isYellow && (
                        <div style={{ ...S.notice, background: "#eff6ff", borderColor: "#bfdbfe", marginBottom: 16, display: "block" }}>
                            <strong>Сары зона ережесі:</strong> Балл ≥ 80 → жалған дабыл (кейс жабылады). Балл &lt; 60 → қызыл зонаға ауыстыру.
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 14 }}>
                            <label style={S.formLabel}>Сіздің бағаңыз (0–100)</label>
                            <input
                                type="number" min="0" max="100"
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                style={S.input}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <label style={S.formLabel}>Жазба / ескертпе</label>
                            <textarea
                                rows={3}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                style={S.textarea}
                                placeholder="Қосымша ескертпе (міндетті емес)"
                            />
                        </div>

                        {submitMsg && (
                            <div style={{
                                ...S.notice,
                                display: "block",
                                marginBottom: 14,
                                background: submitMsg.includes("Сәтті") || submitMsg.includes("тағайындалды") ? "#f0fdf4" : "#fef2f2",
                                borderColor: submitMsg.includes("Сәтті") || submitMsg.includes("тағайындалды") ? "#bbf7d0" : "#fecaca",
                                color: submitMsg.includes("Сәтті") || submitMsg.includes("тағайындалды") ? "#15803d" : "#dc2626",
                            }}>
                                {submitMsg}
                            </div>
                        )}

                        <button type="submit" disabled={submitting} style={S.btnPrimary}>
                            {submitting ? "Сақталуда…" : "Бағалауды сақтау"}
                        </button>
                    </form>
                </div>
            )}

            {/* ——— Resolved ——— */}
            {isResolved && (
                <div style={{ ...S.notice, background: "#f0fdf4", borderColor: "#bbf7d0", display: "block", textAlign: "center", padding: "24px 20px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#15803d" }}>Бұл кейс шешілді</div>
                    {caseData.psych_note && (
                        <p style={{ fontSize: 14, color: "#047857", marginTop: 8 }}>Ескертпе: {caseData.psych_note}</p>
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

function Field({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{value ?? "—"}</div>
        </div>
    );
}

/* ——— Styles ——— */
const S = {
    page: { maxWidth: 820, margin: "0 auto", padding: "32px 24px 60px" },
    backLink: { display: "inline-block", fontSize: 13, fontWeight: 600, color: "#0f172a", textDecoration: "none", marginBottom: 20, opacity: 0.6 },
    muted: { color: "#94a3b8", textAlign: "center", padding: "60px 0" },
    errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "14px 18px", fontWeight: 600, fontSize: 14, marginBottom: 12 },

    card: {
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "20px 24px",
        marginBottom: 16,
    },

    headerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        flexWrap: "wrap",
    },
    caseTitle: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
    badge: {
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
    },
    headerRight: {
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
    },
    metaItem: { textAlign: "right" },
    metaLabel: { display: "block", fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" },
    metaValue: { fontSize: 18, fontWeight: 700, color: "#1e293b" },

    notice: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        border: "1px solid",
        borderRadius: 8,
        padding: "12px 16px",
        fontSize: 13,
        marginBottom: 16,
    },

    sectionTitle: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 15,
        fontWeight: 700,
        color: "#0f172a",
        marginBottom: 14,
    },
    hint: { fontSize: 12, fontWeight: 400, color: "#94a3b8" },
    countBadge: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 22,
        borderRadius: 6,
        background: "#f1f5f9",
        color: "#475569",
        fontSize: 12,
        fontWeight: 700,
    },

    textBlock: {
        border: "1px solid",
        borderRadius: 8,
        padding: "14px 18px",
        fontSize: 14,
        lineHeight: 1.7,
        color: "#334155",
        whiteSpace: "pre-wrap",
    },

    fieldGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
    },

    diaryRow: { paddingBottom: 12, marginBottom: 12 },
    diaryTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    diaryText: { fontSize: 14, color: "#334155", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" },
    aiExplain: { marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" },
    aiExplainHead: { display: "flex", alignItems: "center", gap: 6, marginBottom: 4 },
    aiIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 5, background: "#0f172a", color: "#fff", fontSize: 8, fontWeight: 800 },
    signalChip: { padding: "1px 7px", borderRadius: 4, background: "#e2e8f0", color: "#475569", fontSize: 11, fontWeight: 500 },

    formLabel: { display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 },
    input: {
        width: "100%", maxWidth: 200,
        padding: "9px 14px", borderRadius: 8,
        border: "1px solid #e2e8f0", fontSize: 15, fontWeight: 600,
        outline: "none",
    },
    textarea: {
        width: "100%", padding: "9px 14px", borderRadius: 8,
        border: "1px solid #e2e8f0", fontSize: 14, lineHeight: 1.6,
        resize: "vertical", fontFamily: "inherit", outline: "none",
    },
    select: {
        padding: "8px 12px", borderRadius: 8,
        border: "1px solid #e2e8f0", fontSize: 13,
        background: "#fff", cursor: "pointer",
    },
    btnPrimary: {
        padding: "9px 22px", borderRadius: 8, border: "none",
        background: "#0f172a", color: "#fff", fontSize: 13, fontWeight: 600,
        cursor: "pointer",
    },
    btnDanger: {
        padding: "9px 22px", borderRadius: 8, border: "none",
        background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600,
        cursor: "pointer", whiteSpace: "nowrap",
    },
};
