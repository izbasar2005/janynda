import { useEffect, useState, useMemo } from "react";
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

export default function PsychDashboard() {
    const nav = useNavigate();
    const [activeTab, setActiveTab] = useState("patients");
    const [cases, setCases] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [zoneFilter, setZoneFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    const role = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        return (parseJwt(t)?.role || "").toLowerCase();
    }, []);

    useEffect(() => {
        if (!token()) { nav("/login"); return; }
        if (role !== "psychologist" && role !== "admin" && role !== "super_admin") {
            setError("Бұл бет тек психолог, админ немесе суперадмин үшін.");
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

    const stats = useMemo(() => {
        const s = { total: cases.length, red: 0, yellow: 0, open: 0, resolved: 0 };
        for (const c of cases) {
            if (c.zone === "red") s.red++;
            if (c.zone === "yellow") s.yellow++;
            if (c.status === "open") s.open++;
            if (c.status === "resolved") s.resolved++;
        }
        return s;
    }, [cases]);

    if (error && !cases.length) {
        return <div style={S.page}><div style={S.errorBanner}>{error}</div></div>;
    }

    const patientStats = useMemo(() => {
        const s = { total: patients.length, red: 0, yellow: 0, green: 0 };
        for (const p of patients) {
            if (p.zone === "red") s.red++;
            else if (p.zone === "yellow") s.yellow++;
            else s.green++;
        }
        return s;
    }, [patients]);

    return (
        <div style={S.page}>
            <div style={S.header}>
                <h1 style={S.title}>Психолог кабинеті</h1>
                <p style={S.subtitle}>Пациенттердің AI бағалауы</p>
            </div>

            {/* Main tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #e2e8f0" }}>
                <button type="button" onClick={() => { setActiveTab("patients"); setZoneFilter(""); }}
                    style={activeTab === "patients" ? S.mainTabActive : S.mainTab}>
                    Пациенттер бағасы
                </button>
                <button type="button" onClick={() => { setActiveTab("cases"); setZoneFilter(""); setStatusFilter(""); }}
                    style={activeTab === "cases" ? S.mainTabActive : S.mainTab}>
                    Кейстер
                </button>
            </div>

            {activeTab === "patients" && (
                <>
                    <div style={S.statsRow}>
                        <StatCard label="Барлығы" value={patientStats.total} />
                        <StatCard label="Қызыл зона" value={patientStats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={patientStats.yellow} accent="#d97706" />
                        <StatCard label="Жасыл зона" value={patientStats.green} accent="#059669" />
                    </div>

                    <div style={S.filtersBar}>
                        <div style={S.filterGroup}>
                            <span style={S.filterLabel}>Зона:</span>
                            <Tab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</Tab>
                            <Tab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</Tab>
                            <Tab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</Tab>
                            <Tab active={zoneFilter === "green"} onClick={() => setZoneFilter("green")}>Жасыл</Tab>
                        </div>
                    </div>

                    {loading && <p style={S.muted}>Жүктелуде…</p>}

                    {!loading && patients.length === 0 && (
                        <div style={S.emptyState}>
                            <p style={{ color: "#64748b", fontSize: 15 }}>Бағаланған пациенттер жоқ</p>
                            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>AI бағалау жүргізілгеннен кейін мұнда көрінеді</p>
                        </div>
                    )}

                    {!loading && patients.length > 0 && (
                        <div style={S.tableWrap}>
                            <div style={S.tableHeader}>
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
                    <div style={S.statsRow}>
                        <StatCard label="Барлығы" value={stats.total} />
                        <StatCard label="Қызыл зона" value={stats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={stats.yellow} accent="#d97706" />
                        <StatCard label="Ашық" value={stats.open} accent="#2563eb" />
                        <StatCard label="Шешілді" value={stats.resolved} accent="#059669" />
                    </div>

                    <div style={S.filtersBar}>
                        <div style={S.filterGroup}>
                            <span style={S.filterLabel}>Зона:</span>
                            <Tab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</Tab>
                            <Tab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</Tab>
                            <Tab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</Tab>
                        </div>
                        <div style={S.divider} />
                        <div style={S.filterGroup}>
                            <span style={S.filterLabel}>Статус:</span>
                            <Tab active={statusFilter === ""} onClick={() => setStatusFilter("")}>Барлығы</Tab>
                            <Tab active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Ашық</Tab>
                            <Tab active={statusFilter === "in_review"} onClick={() => setStatusFilter("in_review")}>Қаралуда</Tab>
                            <Tab active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>Шешілді</Tab>
                            <Tab active={statusFilter === "escalated"} onClick={() => setStatusFilter("escalated")}>Күшейтілді</Tab>
                        </div>
                    </div>

                    {loading && <p style={S.muted}>Жүктелуде…</p>}

                    {!loading && cases.length === 0 && (
                        <div style={S.emptyState}>
                            <p style={{ color: "#64748b", fontSize: 15 }}>Кейстер табылмады</p>
                            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Фильтрді өзгертіп көріңіз</p>
                        </div>
                    )}

                    {!loading && cases.length > 0 && (
                        <div style={S.tableWrap}>
                            <div style={S.tableHeader}>
                                <span style={{ ...S.th, flex: "0 0 56px" }}>#</span>
                                <span style={{ ...S.th, flex: "0 0 100px" }}>Зона</span>
                                <span style={{ ...S.th, flex: "0 0 80px" }}>Көзі</span>
                                <span style={{ ...S.th, flex: "0 0 100px" }}>Статус</span>
                                <span style={{ ...S.th, flex: "0 0 72px" }}>AI балл</span>
                                <span style={{ ...S.th, flex: 1 }}>Мәтін</span>
                                <span style={{ ...S.th, flex: "0 0 120px", textAlign: "right" }}>Күні</span>
                            </div>
                            {cases.map((c) => <CaseRow key={c.id} c={c} />)}
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
        <button
            type="button"
            onClick={onClick}
            style={active ? { ...S.tab, ...S.tabActive } : S.tab}
        >
            {children}
        </button>
    );
}

const SOURCE_LABELS = { diary: "Күнделік", chat: "Чат" };

function CaseRow({ c }) {
    const d = new Date(c.created_at);
    const isRed = c.zone === "red";
    const isChat = c.source_type === "chat";

    return (
        <Link to={`/psych/cases/${c.id}`} style={S.rowLink}>
            <div style={{ ...S.row, borderLeftColor: isRed ? "#dc2626" : "#d97706" }}>
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
                        padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: isChat ? "#ede9fe" : "#ecfdf5",
                        color: isChat ? "#6d28d9" : "#047857",
                    }}>
                        {SOURCE_LABELS[c.source_type] || c.source_type || "Күнделік"}
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

                <span style={{ ...S.td, flex: "0 0 120px", textAlign: "right", color: "#94a3b8", fontSize: 13 }}>
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
        <div style={{ ...S.row, borderLeftColor: zoneColor }}>
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

    mainTab: {
        padding: "10px 20px", border: "none", borderBottom: "2px solid transparent",
        background: "none", color: "#94a3b8", fontSize: 14, fontWeight: 600,
        cursor: "pointer", marginBottom: -2,
    },
    mainTabActive: {
        padding: "10px 20px", border: "none", borderBottom: "2px solid #0f172a",
        background: "none", color: "#0f172a", fontSize: 14, fontWeight: 700,
        cursor: "pointer", marginBottom: -2,
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
