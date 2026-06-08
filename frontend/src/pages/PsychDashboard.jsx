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

function saveScroll() {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || window.pageYOffset || 0));
}

const STATUS_STYLES = {
    open: { bg: "#eff6ff", color: "#1d4ed8" },
    in_review: { bg: "#fefce8", color: "#a16207" },
    resolved: { bg: "#f0fdf4", color: "#15803d" },
    escalated: { bg: "#fef2f2", color: "#b91c1c" },
};

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
    const [sourceFilter, setSourceFilter] = useState(init.sourceFilter || "");

    const restoredRef = useRef(false);

    const role = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        return (parseJwt(t)?.role || "").toLowerCase();
    }, []);

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

    useEffect(() => {
        if (loading || restoredRef.current) return;
        restoredRef.current = true;
        const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
        if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
        sessionStorage.removeItem(SCROLL_KEY);
    }, [loading]);

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
        return (
            <div className="page psych-dashboard-page">
                <div className="admin-banner admin-banner--error">{error}</div>
            </div>
        );
    }

    return (
        <div className="page psych-dashboard-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Психолог кабинеті</h2>
                    <p className="muted page-header__subtitle">Пациенттердің AI бағалауы және кейстер</p>
                </div>
            </div>

            <div className="psych-segment" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "patients"}
                    className={`psych-seg-btn${activeTab === "patients" ? " is-active" : ""}`}
                    onClick={() => { setActiveTab("patients"); setZoneFilter(""); }}
                >
                    Пациенттер бағасы
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "cases"}
                    className={`psych-seg-btn${activeTab === "cases" ? " is-active" : ""}`}
                    onClick={() => { setActiveTab("cases"); setZoneFilter(""); setStatusFilter(""); }}
                >
                    Кейстер
                </button>
            </div>

            {activeTab === "patients" && (
                <>
                    <div className="psych-stats-row">
                        <StatCard label="Барлығы" value={patientStats.total} />
                        <StatCard label="Қызыл зона" value={patientStats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={patientStats.yellow} accent="#d97706" />
                        <StatCard label="Жасыл зона" value={patientStats.green} accent="#059669" />
                    </div>

                    <div className="psych-filters">
                        <div className="psych-filter-group">
                            <span className="psych-filter-label">Зона:</span>
                            <FilterTab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</FilterTab>
                            <FilterTab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</FilterTab>
                            <FilterTab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</FilterTab>
                            <FilterTab active={zoneFilter === "green"} onClick={() => setZoneFilter("green")}>Жасыл</FilterTab>
                        </div>
                    </div>

                    {loading && <p className="muted">Жүктелуде…</p>}
                    {!loading && patients.length === 0 && (
                        <EmptyState title="Бағаланған пациенттер жоқ" hint="AI бағалау жүргізілгеннен кейін мұнда көрінеді" />
                    )}

                    {!loading && patients.length > 0 && (
                        <>
                            <div className="psych-mobile-cards">
                                {patients.map((p) => (
                                    <PatientMobileCard key={p.patient_id} p={p} />
                                ))}
                            </div>
                            <div className="psych-desktop-table psych-dashboard-table-wrap">
                                <div className="psych-table-header">
                                    <span className="psych-th" style={{ flex: 1 }}>Пациент</span>
                                    <span className="psych-th" style={{ flex: "0 0 90px", textAlign: "center" }}>Жалпы балл</span>
                                    <span className="psych-th" style={{ flex: "0 0 80px", textAlign: "center" }}>Зона</span>
                                    <span className="psych-th" style={{ flex: "0 0 80px", textAlign: "center" }}>Мин</span>
                                    <span className="psych-th" style={{ flex: "0 0 80px", textAlign: "center" }}>Макс</span>
                                    <span className="psych-th" style={{ flex: "0 0 90px", textAlign: "center" }}>Тренд</span>
                                    <span className="psych-th" style={{ flex: "0 0 100px", textAlign: "center" }}>Бағалаулар</span>
                                    <span className="psych-th" style={{ flex: "0 0 70px", textAlign: "center" }}>Кейстер</span>
                                </div>
                                {patients.map((p) => (
                                    <PatientDesktopRow key={p.patient_id} p={p} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {activeTab === "cases" && (
                <>
                    <div className="psych-source-seg">
                        <SourceBtn active={sourceFilter === ""} onClick={() => setSourceFilter("")}
                            icon="🗂" label="Барлығы" count={sourceCounts.all} color="#0f172a" />
                        <SourceBtn active={sourceFilter === "diary"} onClick={() => setSourceFilter("diary")}
                            icon="📔" label="Күнделік" count={sourceCounts.diary} color="#047857" />
                        <SourceBtn active={sourceFilter === "chat"} onClick={() => setSourceFilter("chat")}
                            icon="💬" label="Чат" count={sourceCounts.chat} color="#6d28d9" />
                    </div>

                    <div className="psych-stats-row">
                        <StatCard label="Барлығы" value={stats.total} />
                        <StatCard label="Қызыл зона" value={stats.red} accent="#dc2626" />
                        <StatCard label="Сары зона" value={stats.yellow} accent="#d97706" />
                        <StatCard label="Ашық" value={stats.open} accent="#2563eb" />
                        <StatCard label="Шешілді" value={stats.resolved} accent="#059669" />
                    </div>

                    <div className="psych-filters">
                        <div className="psych-filter-group">
                            <span className="psych-filter-label">Зона:</span>
                            <FilterTab active={zoneFilter === ""} onClick={() => setZoneFilter("")}>Барлығы</FilterTab>
                            <FilterTab active={zoneFilter === "red"} onClick={() => setZoneFilter("red")}>Қызыл</FilterTab>
                            <FilterTab active={zoneFilter === "yellow"} onClick={() => setZoneFilter("yellow")}>Сары</FilterTab>
                        </div>
                        <div className="psych-filters__divider" />
                        <div className="psych-filter-group">
                            <span className="psych-filter-label">Статус:</span>
                            <FilterTab active={statusFilter === ""} onClick={() => setStatusFilter("")}>Барлығы</FilterTab>
                            <FilterTab active={statusFilter === "open"} onClick={() => setStatusFilter("open")}>Ашық</FilterTab>
                            <FilterTab active={statusFilter === "in_review"} onClick={() => setStatusFilter("in_review")}>Қаралуда</FilterTab>
                            <FilterTab active={statusFilter === "resolved"} onClick={() => setStatusFilter("resolved")}>Шешілді</FilterTab>
                            <FilterTab active={statusFilter === "escalated"} onClick={() => setStatusFilter("escalated")}>Күшейтілді</FilterTab>
                        </div>
                    </div>

                    {loading && <p className="muted">Жүктелуде…</p>}
                    {!loading && visibleCases.length === 0 && (
                        <EmptyState
                            title={sourceFilter === "chat" ? "Чаттан кейстер жоқ" : sourceFilter === "diary" ? "Күнделіктен кейстер жоқ" : "Кейстер табылмады"}
                            hint="Фильтрді өзгертіп көріңіз"
                        />
                    )}

                    {!loading && visibleCases.length > 0 && (
                        <>
                            <div className="psych-mobile-cards">
                                {visibleCases.map((c) => (
                                    <CaseMobileCard key={c.id} c={c} />
                                ))}
                            </div>
                            <div className="psych-desktop-table psych-dashboard-table-wrap">
                                <div className="psych-table-header">
                                    <span className="psych-th" style={{ flex: "0 0 56px" }}>#</span>
                                    <span className="psych-th" style={{ flex: "0 0 100px" }}>Зона</span>
                                    <span className="psych-th" style={{ flex: "0 0 80px" }}>Көзі</span>
                                    <span className="psych-th" style={{ flex: "0 0 100px" }}>Статус</span>
                                    <span className="psych-th" style={{ flex: "0 0 72px" }}>AI балл</span>
                                    <span className="psych-th" style={{ flex: 1 }}>Мәтін</span>
                                    <span className="psych-th" style={{ flex: "0 0 120px", textAlign: "right" }}>Күні</span>
                                </div>
                                {visibleCases.map((c) => (
                                    <CaseDesktopRow key={c.id} c={c} />
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function StatCard({ label, value, accent }) {
    return (
        <div className="psych-stat-card">
            <div className="psych-stat-card__value" style={accent ? { color: accent } : undefined}>{value}</div>
            <div className="psych-stat-card__label">{label}</div>
            {accent ? <div className="psych-stat-card__bar" style={{ background: accent }} /> : null}
        </div>
    );
}

function FilterTab({ active, onClick, children }) {
    return (
        <button type="button" className={`psych-filter-tab${active ? " is-active" : ""}`} onClick={onClick}>
            {children}
        </button>
    );
}

function SourceBtn({ active, onClick, icon, label, count, color }) {
    return (
        <button
            type="button"
            className={`psych-source-btn${active ? " is-active" : ""}`}
            style={active ? { borderColor: color, boxShadow: `inset 0 -3px 0 ${color}`, color } : undefined}
            onClick={onClick}
        >
            <span>{icon}</span>
            <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
            <span
                className="psych-source-btn__count"
                style={active ? { background: color } : undefined}
            >
                {count}
            </span>
        </button>
    );
}

function EmptyState({ title, hint }) {
    return (
        <div className="psych-empty">
            <p style={{ color: "#64748b", fontSize: 15, margin: 0 }}>{title}</p>
            {hint ? <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>{hint}</p> : null}
        </div>
    );
}

function zoneRowClass(zone) {
    if (zone === "red") return "psych-row--red";
    if (zone === "green") return "psych-row--green";
    return "psych-row--yellow";
}

function zoneCardClass(zone) {
    return `psych-mobile-card--${zone === "red" || zone === "green" ? zone : "yellow"}`;
}

function PatientMobileCard({ p }) {
    const zoneColor = p.zone === "red" ? "#dc2626" : p.zone === "yellow" ? "#d97706" : "#059669";
    const trendColor = TREND_COLORS[p.trend] || "#64748b";
    return (
        <article className={`psych-mobile-card ${zoneCardClass(p.zone)}`}>
            <header className="psych-mobile-card__head">
                <h3 className="psych-mobile-card__title">{p.patient_name || `ID: ${p.patient_id}`}</h3>
                <span className="psych-score-chip" style={{ background: `${zoneColor}18`, color: zoneColor }}>
                    {p.score}
                </span>
            </header>
            <dl className="psych-mobile-card__grid">
                <div className="psych-mobile-card__cell">
                    <dt>Зона</dt>
                    <dd style={{ color: zoneColor }}>{ZONE_LABELS[p.zone]}</dd>
                </div>
                <div className="psych-mobile-card__cell">
                    <dt>Мин / Макс</dt>
                    <dd>{p.min_score} / {p.max_score}</dd>
                </div>
                <div className="psych-mobile-card__cell">
                    <dt>Тренд</dt>
                    <dd style={{ color: trendColor }}>
                        {p.trend === "improving" ? "↑" : p.trend === "declining" ? "↓" : "→"} {TREND_LABELS[p.trend] || p.trend}
                    </dd>
                </div>
                <div className="psych-mobile-card__cell">
                    <dt>Бағалаулар</dt>
                    <dd>{p.diary_count} кн. + {p.chat_count} чат</dd>
                </div>
            </dl>
            <footer className="psych-mobile-card__footer">
                <span className="muted" style={{ fontSize: 13 }}>Ашық кейстер</span>
                {p.open_cases > 0 ? (
                    <span className="psych-tag psych-tag--warn">{p.open_cases}</span>
                ) : (
                    <span className="muted">0</span>
                )}
            </footer>
        </article>
    );
}

function PatientDesktopRow({ p }) {
    const zoneColor = p.zone === "red" ? "#dc2626" : p.zone === "yellow" ? "#d97706" : "#059669";
    const zoneBg = p.zone === "red" ? "#fef2f2" : p.zone === "yellow" ? "#fffbeb" : "#f0fdf4";
    const trendColor = TREND_COLORS[p.trend] || "#64748b";

    return (
        <div className={`psych-row ${zoneRowClass(p.zone)}`}>
            <span className="psych-td" style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{p.patient_name || `ID: ${p.patient_id}`}</span>
            </span>
            <span className="psych-td" style={{ flex: "0 0 90px", justifyContent: "center" }}>
                <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 8, fontSize: 16, fontWeight: 800, background: zoneBg, color: zoneColor, minWidth: 44, textAlign: "center" }}>
                    {p.score}
                </span>
            </span>
            <span className="psych-td" style={{ flex: "0 0 80px", justifyContent: "center" }}>
                <span className="psych-zone-dot" style={{ background: zoneColor }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: zoneColor }}>{ZONE_LABELS[p.zone]}</span>
            </span>
            <span className="psych-td" style={{ flex: "0 0 80px", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>{p.min_score}</span>
            <span className="psych-td" style={{ flex: "0 0 80px", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>{p.max_score}</span>
            <span className="psych-td" style={{ flex: "0 0 90px", justifyContent: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: trendColor }}>
                    {p.trend === "improving" ? "↑" : p.trend === "declining" ? "↓" : "→"} {TREND_LABELS[p.trend] || p.trend}
                </span>
            </span>
            <span className="psych-td" style={{ flex: "0 0 100px", justifyContent: "center", fontSize: 11, color: "#64748b" }}>
                {p.diary_count} кн. + {p.chat_count} чат
            </span>
            <span className="psych-td" style={{ flex: "0 0 70px", justifyContent: "center" }}>
                {p.open_cases > 0 ? (
                    <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 12, fontWeight: 700, background: "#fef2f2", color: "#dc2626" }}>{p.open_cases}</span>
                ) : (
                    <span style={{ color: "#cbd5e1", fontSize: 12 }}>0</span>
                )}
            </span>
        </div>
    );
}

function CaseMobileCard({ c }) {
    const d = new Date(c.created_at);
    const isRed = c.zone === "red";
    const isChat = c.source_type === "chat";
    const preview = c.anonymous_text
        ? (c.anonymous_text.length > 120 ? c.anonymous_text.slice(0, 120) + "…" : c.anonymous_text)
        : c.patient_name || null;

    return (
        <Link
            to={`/psych/cases/${c.id}`}
            className={`psych-mobile-card ${zoneCardClass(c.zone)}`}
            onClick={saveScroll}
        >
            <header className="psych-mobile-card__head">
                <div>
                    <span className="psych-mobile-card__id">#{c.id}</span>
                    <h3 className="psych-mobile-card__title" style={{ marginTop: 4 }}>
                        {ZONE_LABELS[c.zone]}
                    </h3>
                </div>
                <StatusBadge status={c.status} />
            </header>
            <dl className="psych-mobile-card__grid">
                <div className="psych-mobile-card__cell">
                    <dt>Көзі</dt>
                    <dd>
                        <span className={`psych-source-tag ${isChat ? "psych-source-tag--chat" : "psych-source-tag--diary"}`}>
                            {isChat ? "💬" : "📔"} {SOURCE_LABELS[c.source_type] || "Күнделік"}
                        </span>
                    </dd>
                </div>
                <div className="psych-mobile-card__cell">
                    <dt>AI балл</dt>
                    <dd>
                        <span className="psych-score-chip" style={{ background: isRed ? "#fef2f2" : "#fffbeb", color: isRed ? "#dc2626" : "#d97706" }}>
                            {c.ai_score}
                        </span>
                    </dd>
                </div>
            </dl>
            {preview ? <p className="psych-mobile-card__preview">{preview}</p> : null}
            <div className="psych-tag-row">
                {isRed && !c.psychologist_id && <span className="psych-tag psych-tag--warn">Тағайындалмаған</span>}
                {c.is_mine && <span className="psych-tag psych-tag--mine">Менікі</span>}
                {c.psych_score != null && <span className="psych-tag psych-tag--psych">Бағасы: {c.psych_score}</span>}
            </div>
            <footer className="psych-mobile-card__footer">
                <span className="muted" style={{ fontSize: 12 }}>
                    {d.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>Ашу →</span>
            </footer>
        </Link>
    );
}

function CaseDesktopRow({ c }) {
    const d = new Date(c.created_at);
    const isRed = c.zone === "red";
    const isChat = c.source_type === "chat";

    return (
        <Link className="psych-row-link" to={`/psych/cases/${c.id}`} onClick={saveScroll}>
            <div className={`psych-row ${zoneRowClass(c.zone)}`}>
                <span className="psych-td" style={{ flex: "0 0 56px", fontWeight: 600, color: "#94a3b8" }}>{c.id}</span>
                <span className="psych-td" style={{ flex: "0 0 100px" }}>
                    <span className="psych-zone-dot" style={{ background: isRed ? "#dc2626" : "#d97706" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: isRed ? "#991b1b" : "#92400e" }}>{ZONE_LABELS[c.zone]}</span>
                </span>
                <span className="psych-td" style={{ flex: "0 0 80px" }}>
                    <span className={`psych-source-tag ${isChat ? "psych-source-tag--chat" : "psych-source-tag--diary"}`}>
                        {isChat ? "💬" : "📔"} {SOURCE_LABELS[c.source_type] || c.source_type || "Күнделік"}
                    </span>
                </span>
                <span className="psych-td" style={{ flex: "0 0 100px" }}>
                    <StatusBadge status={c.status} />
                </span>
                <span className="psych-td" style={{ flex: "0 0 72px" }}>
                    <span className="psych-score-chip" style={{ background: isRed ? "#fef2f2" : "#fffbeb", color: isRed ? "#dc2626" : "#d97706" }}>
                        {c.ai_score}
                    </span>
                </span>
                <span className="psych-td" style={{ flex: 1, minWidth: 0 }}>
                    {c.anonymous_text ? (
                        <span className="psych-text-preview">
                            {c.anonymous_text.length > 80 ? c.anonymous_text.slice(0, 80) + "…" : c.anonymous_text}
                        </span>
                    ) : c.patient_name ? (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{c.patient_name}</span>
                    ) : (
                        <span style={{ color: "#cbd5e1", fontSize: 13 }}>—</span>
                    )}
                    <div className="psych-tag-row">
                        {isRed && !c.psychologist_id && <span className="psych-tag psych-tag--warn">Тағайындалмаған</span>}
                        {c.is_mine && <span className="psych-tag psych-tag--mine">Менікі</span>}
                        {c.psych_score != null && <span className="psych-tag psych-tag--psych">Бағасы: {c.psych_score}</span>}
                    </div>
                </span>
                <span className="psych-td" style={{ flex: "0 0 120px", justifyContent: "flex-end", color: "#94a3b8", fontSize: 13 }}>
                    {d.toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" })}
                </span>
            </div>
        </Link>
    );
}

function StatusBadge({ status }) {
    const m = STATUS_STYLES[status] || STATUS_STYLES.open;
    return (
        <span className="psych-status-badge" style={{ background: m.bg, color: m.color }}>
            {STATUS_LABELS[status] || status}
        </span>
    );
}
