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

const ZONE_LABELS = { red: "Қызыл", yellow: "Сары", green: "Жасыл" };
const ZONE_COLORS = { red: "#dc2626", yellow: "#d97706", green: "#16a34a" };

export default function PsychAssignments() {
    const nav = useNavigate();
    const [patients, setPatients] = useState([]);
    const [psychologists, setPsychologists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [assignFilter, setAssignFilter] = useState("");
    const [zoneFilter, setZoneFilter] = useState("");
    const [selected, setSelected] = useState({});
    const [busy, setBusy] = useState(0);

    const role = useMemo(() => {
        const t = token();
        if (!t) return "guest";
        return (parseJwt(t)?.role || "").toLowerCase();
    }, []);

    function loadPatients() {
        const params = [];
        if (assignFilter) params.push("assigned=" + assignFilter);
        if (zoneFilter) params.push("zone=" + zoneFilter);
        let url = "/api/v1/psych/patients";
        if (params.length) url += "?" + params.join("&");
        return api(url, { auth: true }).then((d) => setPatients(Array.isArray(d) ? d : []));
    }

    useEffect(() => {
        if (!token()) { nav("/login"); return; }
        if (role !== "head_psychologist") {
            setError("Бұл бет тек бас психолог үшін.");
            setLoading(false);
            return;
        }
        setLoading(true);
        Promise.all([
            loadPatients(),
            api("/api/v1/psych/psychologists", { auth: true }).then((d) => setPsychologists(Array.isArray(d) ? d : [])),
        ])
            .catch((e) => setError(e.message || "Қате"))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nav, role, assignFilter, zoneFilter]);

    async function refresh() {
        try {
            await Promise.all([
                loadPatients(),
                api("/api/v1/psych/psychologists", { auth: true }).then((d) => setPsychologists(Array.isArray(d) ? d : [])),
            ]);
        } catch (e) {
            setError(e.message || "Қате");
        }
    }

    async function handleAssign(patientId) {
        const psychId = Number(selected[patientId] || 0);
        if (!psychId) return;
        setBusy(patientId);
        setMsg("");
        try {
            await api("/api/v1/psych/assignments", {
                method: "POST",
                auth: true,
                body: { patient_id: patientId, psychologist_id: psychId },
            });
            setMsg("Пациент психологқа бекітілді ✅");
            await refresh();
            setTimeout(() => setMsg(""), 2500);
        } catch (e) {
            setMsg(e.message || "Қате");
        } finally {
            setBusy(0);
        }
    }

    async function handleUnassign(patientId) {
        setBusy(patientId);
        setMsg("");
        try {
            await api(`/api/v1/psych/assignments/${patientId}`, { method: "DELETE", auth: true });
            setMsg("Бекіту алынып тасталды.");
            await refresh();
            setTimeout(() => setMsg(""), 2500);
        } catch (e) {
            setMsg(e.message || "Қате");
        } finally {
            setBusy(0);
        }
    }

    if (error) {
        return (
            <div className="page psych-assignments-page">
                <div className="admin-banner admin-banner--error">{error}</div>
            </div>
        );
    }

    return (
        <div className="page psych-assignments-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Пациенттерді бөлу</h2>
                    <p className="muted page-header__subtitle">
                        Пациенттерді психологтарға бекітіңіз. Қызыл кейстер автоматты түрде бекітілген психологқа жіберіледі.
                    </p>
                </div>
            </div>

            {msg && <div className="psych-msg-banner">{msg}</div>}

            <div className="psych-assign-psychologists">
                {psychologists.map((p) => (
                    <div key={p.id} className="psych-assign-psych-card">
                        <span className="psych-assign-psych-card__name">{p.full_name}</span>
                        <span className="psych-assign-psych-card__count">{p.patient_count} пациент</span>
                    </div>
                ))}
                {psychologists.length === 0 && <span className="muted">Психологтар жоқ.</span>}
            </div>

            <div className="psych-assign-filters">
                <select className="input" value={assignFilter} onChange={(e) => setAssignFilter(e.target.value)} aria-label="Бекіту фильтрі">
                    <option value="">Барлығы</option>
                    <option value="0">Бекітілмегендер</option>
                    <option value="1">Бекітілгендер</option>
                </select>
                <select className="input" value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} aria-label="Аймақ фильтрі">
                    <option value="">Барлық аймақ</option>
                    <option value="red">Қызыл</option>
                    <option value="yellow">Сары</option>
                    <option value="green">Жасыл</option>
                </select>
            </div>

            {loading ? (
                <p className="muted">Жүктелуде…</p>
            ) : (
                <>
                    <div className="psych-mobile-cards" aria-label="Пациенттер">
                        {patients.map((p) => (
                            <article
                                key={p.patient_id}
                                className={`psych-assign-card psych-mobile-card--${p.zone || "green"}`}
                            >
                                <header className="psych-assign-card__head">
                                    <h3 className="psych-assign-card__name">{p.patient_name || `#${p.patient_id}`}</h3>
                                    <span
                                        className="psych-zone-pill"
                                        style={{ background: ZONE_COLORS[p.zone] || "#64748b" }}
                                    >
                                        {ZONE_LABELS[p.zone] || p.zone}
                                    </span>
                                    {p.psychologist_id ? (
                                        <p className="psych-assign-card__assigned">
                                            {p.psychologist_name || `#${p.psychologist_id}`}
                                        </p>
                                    ) : (
                                        <p className="psych-assign-card__unassigned">— бекітілмеген —</p>
                                    )}
                                </header>
                                <dl className="psych-mobile-card__grid">
                                    <div className="psych-mobile-card__cell">
                                        <dt>Балл</dt>
                                        <dd>{p.score}</dd>
                                    </div>
                                    <div className="psych-mobile-card__cell">
                                        <dt>Ашық кейс</dt>
                                        <dd>{p.open_cases || 0}</dd>
                                    </div>
                                </dl>
                                <div className="psych-assign-card__fields">
                                    <select
                                        className="input"
                                        value={selected[p.patient_id] || ""}
                                        onChange={(e) => setSelected((s) => ({ ...s, [p.patient_id]: e.target.value }))}
                                    >
                                        <option value="">Психолог таңдаңыз…</option>
                                        {psychologists.map((ps) => (
                                            <option key={ps.id} value={ps.id}>{ps.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="psych-assign-card__actions">
                                    <button
                                        type="button"
                                        className="btn"
                                        disabled={busy === p.patient_id || !selected[p.patient_id]}
                                        onClick={() => handleAssign(p.patient_id)}
                                    >
                                        Бекіту
                                    </button>
                                    {p.psychologist_id ? (
                                        <button
                                            type="button"
                                            className="btn ghost"
                                            disabled={busy === p.patient_id}
                                            onClick={() => handleUnassign(p.patient_id)}
                                        >
                                            Бекітуді алу
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                        {patients.length === 0 && <p className="muted">Пациенттер жоқ.</p>}
                    </div>

                    <div className="psych-assign-desktop">
                        <table className="psych-assign-table">
                            <thead>
                                <tr>
                                    <th>Пациент</th>
                                    <th>Аймақ</th>
                                    <th>Балл</th>
                                    <th>Ашық кейс</th>
                                    <th>Психолог</th>
                                    <th>Әрекет</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((p) => (
                                    <tr key={p.patient_id}>
                                        <td>{p.patient_name || `#${p.patient_id}`}</td>
                                        <td>
                                            <span
                                                className="psych-zone-pill"
                                                style={{ background: ZONE_COLORS[p.zone] || "#64748b" }}
                                            >
                                                {ZONE_LABELS[p.zone] || p.zone}
                                            </span>
                                        </td>
                                        <td>{p.score}</td>
                                        <td>{p.open_cases || 0}</td>
                                        <td>
                                            {p.psychologist_id ? (
                                                <span style={{ color: "#6d28d9", fontWeight: 600 }}>
                                                    {p.psychologist_name || `#${p.psychologist_id}`}
                                                </span>
                                            ) : (
                                                <span className="muted" style={{ fontStyle: "italic" }}>— бекітілмеген —</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                <select
                                                    className="input"
                                                    style={{ maxWidth: 180, minHeight: 36, fontSize: 13 }}
                                                    value={selected[p.patient_id] || ""}
                                                    onChange={(e) => setSelected((s) => ({ ...s, [p.patient_id]: e.target.value }))}
                                                >
                                                    <option value="">Психолог таңдаңыз…</option>
                                                    {psychologists.map((ps) => (
                                                        <option key={ps.id} value={ps.id}>{ps.full_name}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    type="button"
                                                    className="btn"
                                                    style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
                                                    disabled={busy === p.patient_id || !selected[p.patient_id]}
                                                    onClick={() => handleAssign(p.patient_id)}
                                                >
                                                    Бекіту
                                                </button>
                                                {p.psychologist_id ? (
                                                    <button
                                                        type="button"
                                                        className="btn ghost"
                                                        disabled={busy === p.patient_id}
                                                        onClick={() => handleUnassign(p.patient_id)}
                                                    >
                                                        Алу
                                                    </button>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {patients.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="muted">Пациенттер жоқ.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
