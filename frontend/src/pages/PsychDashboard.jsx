import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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

const ZONE_LABELS = { red: "Қызыл", yellow: "Сары", green: "Жасыл" };
const STATUS_LABELS = {
    open: "Ашық",
    in_review: "Қаралуда",
    resolved: "Шешілді",
    escalated: "Күшейтілді",
};

const TREND_LABELS = { improving: "Жақсаруда", stable: "Тұрақты", declining: "Нашарлауда" };
const TREND_COLORS = { improving: "#059669", stable: "#64748b", declining: "#dc2626" };

const SOURCE_LABELS = { diary: "Күнделік", chat: "Чат" };

/* ——— Persisted UI state (survives navigation to a case and back) ——— */
const DASH_KEY = "psychDashState";
const SCROLL_KEY = "psychDashScroll";

function loadDashState() {
    try {
        return JSON.parse(sessionStorage.getItem(DASH_KEY)) || {};
    } catch {
        return {};
    }
}
function saveDashState(patch) {
    sessionStorage.setItem(DASH_KEY, JSON.stringify({ ...loadDashState(), ...patch }));
}

export default function PsychDashboard() {
    const nav = useNavigate();
    const init = useMemo(() => loadDashState(), []);

    const [activeTab, setActiveTab] = useState(init.activeTab || "patients");
    const [cases, setCases] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [zoneFilter, setZoneFilter] = useState(init.zoneFilter || "");
    const [statusFilter, setStatusFilter] = useState(init.statusFilter || "");
    const [sourceFilter, setSourceFilter] = useState(init.sourceFilter || ""); // "" | "diary" | "chat"

    const restoredRef = useRef(false);

    const role = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        return (parseJwt(t)?.role || "").toLowerCase();
    }, []);

    // Persist tab + filters whenever they change.
    useEffect(() => {
        saveDashState({ activeTab, zoneFilter, statusFilter, sourceFilter });
    }, [activeTab, zoneFilter, statusFilter, sourceFilter]);

    useEffect(() => {
        if (!token()) { nav("/login"); return; }
        if (role !== "psychologist" && role !== "head_psychologist") {
            setError("Бұл бет тек психолог үшін.");
            setLoading(false);
            return;
        }

        setLoading(true);

        if (activeTab === "cases") {
            let url = "/api/v1/psych/cases";
            const params = [];
            if (zoneFilter) params.push("zone=" + zoneFilter);
            if (statusFilter) params.push("status=" + statusFilter);
            if (params.length) url += "?" + params.join("&");

            api(url, { auth: true })
                .then((data) => setCases(Array.isArray(data) ? data : []))
                .catch((e) => setError(e.message || "Қате"))
                .finally(() => setLoading(false));
        } else {
            let url = "/api/v1/psych/patients";
            if (zoneFilter) url += "?zone=" + zoneFilter;

            api(url, { auth: true })
                .then((data) => setPatients(Array.isArray(data) ? data : []))
                .catch((e) => setError(e.message || "Қате"))
                .finally(() => setLoading(false));
        }
    }, [nav, role, activeTab, zoneFilter, statusFilter]);

    // Restore scroll position once after returning from a case detail page.
    useEffect(() => {
        if (loading || restoredRef.current) return;
        restoredRef.current = true;
        const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
        if (y > 0) {
            requestAnimationFrame(() => window.scrollTo(0, y));
        }
        sessionStorage.removeItem(SCROLL_KEY);
    }, [loading]);

    // Cases filtered by source (Күнделік / Чат) on the client.
    const visibleCases = useMemo(() => {
        if (!sourceFilter) return cases;
        return cases.filter((c) => (c.source_type || "diary") === sourceFilter);
    }, [cases, sourceFilter]);

    const sourceCounts = useMemo(() => {
        let diary = 0, chat = 0;
        for (const c of cases) {
            if ((c.source_type || "diary") === "chat") chat++;
            else diary++;
        }
        return { all: cases.length, diary, chat };
    }, [cases]);

    const stats = useMemo(() => {
        const s = { total: visibleCases.length, red: 0, yellow: 0, open: 0, resolved: 0 };
        for (const c of visibleCases) {
            if (c.zone === "red") s.red++;
            if (c.zone === "yellow") s.yellow++;
            if (c.status === "open") s.open++;
            if (c.status === "resolved") s.resolved++;
        }
        return s;
    }, [visibleCases]);

    const patientStats = useMemo(() => {
        const s = { total: patients.length, red: 0, yellow: 0, green: 0 };
        for (const p of patients) {
            if (p.zone === "red") s.red++;
            else if (p.zone === "yellow") s.yellow++;
            else s.green++;
        }
        return s;
    }, [patients]);

    if (error && !cases.length && !patients.length) {
        return <div style={S.page}><div style={S.errorBanner}>{error}</div></div>;
    }

    return (
        <div className="psych-dashboard-page" style={S.page}>
            <div style={S.header}>
                <h1 style={S.title}>Психолог кабинеті</h1>
                <p style={S.subtitle}>Пациенттердің AI бағалауы және кейстер</p>
            </div>

            {/* Main tabs (segmented) */}
            <div className="psych-dashboard-main-tabs" style={S.segment}>
                <button type="button" onClick={() => { setActiveTab("patients"); setZoneFilter(""); }}
                    style={activeTab === "patients" ? S.segActive : S.seg}>
                    Пациенттер бағасы
                </button>
                <button type="button" onClick={() => { setActiveTab("cases"); setZoneFilter(""); setStatusFilter(""); }}
                    style={activeTab === "cases" ? S.segActive : S.seg}>
                    Кейстер
                </button>
            </div>

            {activeTab === "patients" && (
                <>
                    <div className="psych-dashboard-stats-row" style={S.statsRow}>
                        <StatCard label="Барлығы" value={patientStats.total} />
                        <StatCard label="Қызыл зона" value={patientStats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={patientStats.yellow} accent="#d97706" />
                        <StatCard label="Жасыл зона" value={patientStats.green} accent="#059669" />
                    </div>

                    <div className="psych-dashboard-filters" style={S.filtersBar}>
                        <div className="psych-dashboard-filter-group" style={S.filterGroup}>
                            <span style={S.filterLabel}>Зона:</span>
                            <Tab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</Tab>
                            <Tab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</Tab>
                            <Tab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</Tab>
                            <Tab active={zoneFilter === "green"} onClick={() => setZoneFilter("green")}>Жасыл</Tab>
                        </div>
                    </div>

                    {loading && <p style={S.muted}>Жүктелуде…</p>}

                    {!loading && patients.length === 0 && (
                        <EmptyState title="Бағаланған пациенттер жоқ" hint="AI бағалау жүргізілгеннен кейін мұнда көрінеді" />
                    )}

                    {!loading && patients.length > 0 && (
                        <div className="psych-dashboard-table-wrap" style={S.tableWrap}>
                            <div className="psych-dashboard-table-header" style={S.tableHeader}>
                                <span style={{ ...S.th, flex: 1 }}>Пациент</span>
                                <span style={{ ...S.th, flex: "0 0 90px", textAlign: "center" }}>Жалпы балл</span>
                                <span style={{ ...S.th, flex: "0 0 80px", textAlign: "center" }}>Зона</span>
                                <span style={{ ...S.th, flex: "0 0 80px", textAlign: "center" }}>Мин</span>
                                <span style={{ ...S.th, flex: "0 0 80px", textAlign: "center" }}>Макс</span>
                                <span style={{ ...S.th, flex: "0 0 90px", textAlign: "center" }}>Тренд</span>
                                <span style={{ ...S.th, flex: "0 0 100px", textAlign: "center" }}>Бағалаулар</span>
                                <span style={{ ...S.th, flex: "0 0 70px", textAlign: "center" }}>Кейстер</span>
                            </div>
                            {patients.map((p) => <PatientRow key={p.patient_id} p={p} />)}
                        </div>
                    )}
                </>
            )}

            {activeTab === "cases" && (
                <>
                    {/* Источник кейса: Күнделік / Чат — вынесено отдельным крупным переключателем */}
                    <div style={S.sourceSeg}>
                        <SourceBtn active={sourceFilter === ""} onClick={() => setSourceFilter("")}
                            icon="🗂" label="Барлығы" count={sourceCounts.all} color="#0f172a" />
                        <SourceBtn active={sourceFilter === "diary"} onClick={() => setSourceFilter("diary")}
                            icon="📔" label="Күнделік" count={sourceCounts.diary} color="#047857" />
                        <SourceBtn active={sourceFilter === "chat"} onClick={() => setSourceFilter("chat")}
                            icon="💬" label="Чат" count={sourceCounts.chat} color="#6d28d9" />
                    </div>

                    <div className="psych-dashboard-stats-row" style={S.statsRow}>
                        <StatCard label="Барлығы" value={stats.total} />
                        <StatCard label="Қызыл зона" value={stats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={stats.yellow} accent="#d97706" />
                        <StatCard label="Ашық" value={stats.open} accent="#2563eb" />
                        <StatCard label="Шешілді" value={stats.resolved} accent="#059669" />
                    </div>

                    <div className="psych-dashboard-filters" style={S.filtersBar}>
                        <div className="psych-dashboard-filter-group" style={S.filterGroup}>
                            <span style={S.filterLabel}>Зона:</span>
                            <Tab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</Tab>
                            <Tab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</Tab>
                            <Tab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</Tab>
                        </div>
                        <div className="psych-dashboard-divider" style={S.divider} />
                        <div className="psych-dashboard-filter-group" style={S.filterGroup}>
                            <span style={S.filterLabel}>Статус:</span>
                            <Tab active={statusFilter === ""} onClick={() => setStatusFilter("")}>Барлығы</Tab>
                            <Tab active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Ашық</Tab>
                            <Tab active={statusFilter === "in_review"} onClick={() => setStatusFilter("in_review")}>Қаралуда</Tab>
                            <Tab active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>Шешілді</Tab>
                            <Tab active={statusFilter === "escalated"} onClick={() => setStatusFilter("escalated")}>Күшейтілді</Tab>
                        </div>
                    </div>

                    {loading && <p style={S.muted}>Жүктелуде…</p>}

                    {!loading && visibleCases.length === 0 && (
                        <EmptyState
                            title={sourceFilter === "chat" ? "Чаттан кейстер жоқ" : sourceFilter === "diary" ? "Күнделіктен кейстер жоқ" : "Кейстер табылмады"}
                            hint="Фильтрді өзгертіп көріңіз"
                        />
                    )}

                    {!loading && visibleCases.length > 0 && (
                        <div className="psych-dashboard-table-wrap" style={S.tableWrap}>
                            <div className="psych-dashboard-table-header" style={S.tableHeader}>
                                <span style={{ ...S.th, flex: "0 0 56px" }}>#</span>
                                <span style={{ ...S.th, flex: "0 0 100px" }}>Зона</span>
                                <span style={{ ...S.th, flex: "0 0 80px" }}>Көзі</span>
                                <span style={{ ...S.th, flex: "0 0 100px" }}>Статус</span>
                                <span style={{ ...S.th, flex: "0 0 72px" }}>AI балл</span>
                                <span style={{ ...S.th, flex: 1 }}>Мәтін</span>
                                <span style={{ ...S.th, flex: "0 0 120px", textAlign: "right" }}>Күні</span>
                            </div>
                            {visibleCases.map((c) => <CaseRow key={c.id} c={c} />)}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/* ——— Sub-components ——— */

function StatCard({ label, value, accent }) {
    return (
        <div style={S.statCard}>
            <div style={{ ...S.statValue, color: accent || "#1e293b" }}>{value}</div>
            <div style={S.statLabel}>{label}</div>
            {accent && <div style={{ ...S.statBar, background: accent }} />}
        </div>
    );
}

function Tab({ active, onClick, children }) {
    return (
        <button type="button" onClick={onClick} style={active ? { ...S.tab, ...S.tabActive } : S.tab}>
            {children}
        </button>
    );
}

function SourceBtn({ active, onClick, icon, label, count, color }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                ...S.sourceBtn,
                ...(active ? { borderColor: color, background: "#fff", boxShadow: `inset 0 -3px 0 ${color}`, color } : {}),
            }}
        >
            <span style={S.sourceIcon}>{icon}</span>
            <span style={S.sourceLabel}>{label}</span>
            <span style={{ ...S.sourceCount, ...(active ? { background: color, color: "#fff" } : {}) }}>{count}</span>
        </button>
    );
}

function EmptyState({ title, hint }) {
    return (
        <div style={S.emptyState}>
            <p style={{ color: "#64748b", fontSize: 15 }}>{title}</p>
            {hint && <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{hint}</p>}
        </div>
    );
}

function saveScroll() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || window.pageYOffset || 0));
}

function CaseRow({ c }) {
    const d = new Date(c.created_at);
    const isRed = c.zone === "red";
    const isChat = c.source_type === "chat";

    return (
        <Link className="psych-dashboard-row-link" to={`/psych/cases/${c.id}`} style={S.rowLink} onClick={saveScroll}>
            <div className="psych-dashboard-row psych-dashboard-row--case" style={{ ...S.row, borderLeftColor: isRed ? "#dc2626" : "#d97706" }}>
                <span style={{ ...S.td, flex: "0 0 56px", fontWeight: 600, color: "#94a3b8" }}>
                    {c.id}
                </span>

                <span style={{ ...S.td, flex: "0 0 100px" }}>
                    <span style={{ ...S.zoneDot, background: isRed ? "#dc2626" : "#d97706" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: isRed ? "#991b1b" : "#92400e" }}>
                        {ZONE_LABELS[c.zone]}
                    </span>
                </span>

                <span style={{ ...S.td, flex: "0 0 80px" }}>
                    <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: isChat ? "#ede9fe" : "#ecfdf5",
                        color: isChat ? "#6d28d9" : "#047857",
                    }}>
                        {isChat ? "💬" : "📔"} {SOURCE_LABELS[c.source_type] || c.source_type || "Күнделік"}
                    </span>
                </span>

                <span style={{ ...S.td, flex: "0 0 100px" }}>
                    <StatusBadge status={c.status} />
                </span>

                <span style={{ ...S.td, flex: "0 0 72px" }}>
                    <span style={{ ...S.scoreChip, background: isRed ? "#fef2f2" : "#fffbeb", color: isRed ? "#dc2626" : "#d97706" }}>
                        {c.ai_score}
                    </span>
                </span>

                <span style={{ ...S.td, flex: 1, minWidth: 0 }}>
                    <div style={S.textCol}>
                        {c.anonymous_text ? (
                            <span style={S.textPreview}>
                                {c.anonymous_text.length > 80 ? c.anonymous_text.slice(0, 80) + "…" : c.anonymous_text}
                            </span>
                        ) : c.patient_name ? (
                            <span style={S.patientName}>{c.patient_name}</span>
                        ) : (
                            <span style={{ color: "#cbd5e1", fontSize: 13 }}>—</span>
                        )}
                        <div style={S.tagRow}>
                            {isRed && !c.psychologist_id && (
                                <span style={S.tagWarn}>Тағайындалмаған</span>
                            )}
                            {c.is_mine && (
                                <span style={S.tagMine}>Менікі</span>
                            )}
                            {c.psych_score != null && (
                                <span style={S.tagPsych}>Бағасы: {c.psych_score}</span>
                            )}
                        </div>
                    </div>
                </span>

                <span style={{ ...S.td, flex: "0 0 120px", textAlign: "right", color: "#94a3b8", fontSize: 13, justifyContent: "flex-end" }}>
                    {d.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}
                </span>
            </div>
        </Link>
    );
}

function PatientRow({ p }) {
    const zoneColor = p.zone === "red" ? "#dc2626" : p.zone === "yellow" ? "#d97706" : "#059669";
    const zoneBg = p.zone === "red" ? "#fef2f2" : p.zone === "yellow" ? "#fffbeb" : "#f0fdf4";
    const trendColor = TREND_COLORS[p.trend] || "#64748b";

    return (
        <div className="psych-dashboard-row psych-dashboard-row--patient" style={{ ...S.row, borderLeftColor: zoneColor }}>
            <span style={{ ...S.td, flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{p.patient_name || `ID: ${p.patient_id}`}</span>
            </span>

            <span style={{ ...S.td, flex: "0 0 90px", justifyContent: "center" }}>
                <span style={{
                    display: "inline-block", padding: "4px 14px", borderRadius: 8,
                    fontSize: 16, fontWeight: 800, background: zoneBg, color: zoneColor,
                    minWidth: 44, textAlign: "center",
                }}>
                    {p.score}
                </span>
            </span>

            <span style={{ ...S.td, flex: "0 0 80px", justifyContent: "center" }}>
                <span style={{ ...S.zoneDot, background: zoneColor }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: zoneColor }}>
                    {ZONE_LABELS[p.zone]}
                </span>
            </span>

            <span style={{ ...S.td, flex: "0 0 80px", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
                {p.min_score}
            </span>

            <span style={{ ...S.td, flex: "0 0 80px", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
                {p.max_score}
            </span>

            <span style={{ ...S.td, flex: "0 0 90px", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>
                    {p.trend === "improving" ? "↑" : p.trend === "declining" ? "↓" : "→"}{" "}
                    {TREND_LABELS[p.trend] || p.trend}
                </span>
            </span>

            <span style={{ ...S.td, flex: "0 0 100px", justifyContent: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                    {p.diary_count} кн. + {p.chat_count} чат
                </span>
            </span>

            <span style={{ ...S.td, flex: "0 0 70px", justifyContent: "center" }}>
                {p.open_cases > 0 ? (
                    <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700, background: "#fef2f2", color: "#dc2626" }}>
                        {p.open_cases}
                    </span>
                ) : (
                    <span style={{ color: "#cbd5e1", fontSize: 12 }}>0</span>
                )}
            </span>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        open: { bg: "#eff6ff", color: "#1d4ed8" },
        in_review: { bg: "#fefce8", color: "#a16207" },
        resolved: { bg: "#f0fdf4", color: "#15803d" },
        escalated: { bg: "#fef2f2", color: "#b91c1c" },
    };
    const m = map[status] || map.open;
    return (
        <span style={{ padding: "3px 10px", borderRadius: 6, background: m.bg, color: m.color, fontSize: 12, fontWeight: 600 }}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}

/* ——— Styles ——— */
const S = {
    page: { maxWidth: 1000, margin: "0 auto", padding: "32px 24px 60px" },
    header: { marginBottom: 24 },
    title: { fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 },
    subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },

    segment: {
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "#f1f5f9",
        borderRadius: 12,
        marginBottom: 24,
    },
    seg: {
        padding: "9px 20px", border: "none", borderRadius: 9,
        background: "transparent", color: "#64748b", fontSize: 14, fontWeight: 600,
        cursor: "pointer", transition: "all 0.12s",
    },
    segActive: {
        padding: "9px 20px", border: "none", borderRadius: 9,
        background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 700,
        cursor: "pointer", boxShadow: "0 1px 3px rgba(15,23,42,0.12)",
    },

    sourceSeg: {
        display: "flex",
        gap: 12,
        marginBottom: 20,
        flexWrap: "wrap",
    },
    sourceBtn: {
        flex: "1 1 140px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 18px",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        color: "#475569",
        cursor: "pointer",
        fontSize: 15,
        fontWeight: 600,
        transition: "all 0.12s",
    },
    sourceIcon: { fontSize: 20, lineHeight: 1 },
    sourceLabel: { flex: 1, textAlign: "left" },
    sourceCount: {
        minWidth: 26,
        padding: "2px 8px",
        borderRadius: 999,
        background: "#e2e8f0",
        color: "#475569",
        fontSize: 13,
        fontWeight: 700,
        textAlign: "center",
    },

    statsRow: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        position: "relative",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "18px 16px 14px",
        textAlign: "center",
        overflow: "hidden",
    },
    statValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 },
    statLabel: { fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 500 },
    statBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3 },

    filtersBar: {
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginBottom: 20,
        flexWrap: "wrap",
    },
    filterGroup: { display: "flex", alignItems: "center", gap: 6 },
    filterLabel: { fontSize: 13, fontWeight: 600, color: "#475569", marginRight: 2 },
    divider: { width: 1, height: 24, background: "#e2e8f0" },
    tab: {
        padding: "5px 12px",
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#64748b",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.12s",
    },
    tabActive: {
        background: "#0f172a",
        color: "#fff",
        borderColor: "#0f172a",
    },

    tableWrap: {
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        overflow: "hidden",
    },
    tableHeader: {
        display: "flex",
        alignItems: "center",
        padding: "10px 20px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
    },
    th: {
        fontSize: 11,
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
    },

    rowLink: { textDecoration: "none", color: "inherit", display: "block" },
    row: {
        display: "flex",
        alignItems: "center",
        padding: "14px 20px",
        borderBottom: "1px solid #f1f5f9",
        borderLeft: "3px solid",
        transition: "background 0.1s",
        cursor: "pointer",
    },
    td: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
    },
    zoneDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
    scoreChip: {
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
    },

    textCol: { minWidth: 0 },
    textPreview: {
        display: "block",
        fontSize: 13,
        color: "#475569",
        lineHeight: 1.4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
    },
    patientName: { fontSize: 13, fontWeight: 600, color: "#334155" },
    tagRow: { display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" },
    tagWarn: {
        fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 4,
        background: "#fef2f2", color: "#dc2626",
    },
    tagMine: {
        fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 4,
        background: "#eff6ff", color: "#2563eb",
    },
    tagPsych: {
        fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 4,
        background: "#f5f3ff", color: "#7c3aed",
    },

    emptyState: { textAlign: "center", padding: "48px 20px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10 },
    muted: { color: "#94a3b8", fontSize: 14 },
    errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "14px 18px", fontWeight: 600, fontSize: 14 },
};
