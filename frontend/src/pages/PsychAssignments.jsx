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
    const [assignFilter, setAssignFilter] = useState(""); // "" | "0" | "1"
    const [zoneFilter, setZoneFilter] = useState("");
    const [selected, setSelected] = useState({}); // { patientId: psychologistId }
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
        return <div style={S.page}><div style={S.errorBanner}>{error}</div></div>;
    }

    return (
        <div style={S.page}>
            <div style={S.headerRow}>
                <div>
                    <h1 style={S.title}>Пациенттерді бөлу</h1>
                    <p style={S.subtitle}>Пациенттерді психологтарға бекітіңіз. Қызыл кейстер автоматты түрде бекітілген психологқа жіберіледі.</p>
                </div>
            </div>

            {msg && <div style={S.msgBanner}>{msg}</div>}

            <div style={S.psychRow}>
                {psychologists.map((p) => (
                    <div key={p.id} style={S.psychCard}>
                        <span style={S.psychName}>{p.full_name}</span>
                        <span style={S.psychCount}>{p.patient_count} пациент</span>
                    </div>
                ))}
                {psychologists.length === 0 && <span style={S.muted}>Психологтар жоқ.</span>}
            </div>

            <div style={S.filters}>
                <select style={S.select} value={assignFilter} onChange={(e) => setAssignFilter(e.target.value)}>
                    <option value="">Барлығы</option>
                    <option value="0">Бекітілмегендер</option>
                    <option value="1">Бекітілгендер</option>
                </select>
                <select style={S.select} value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
                    <option value="">Барлық аймақ</option>
                    <option value="red">Қызыл</option>
                    <option value="yellow">Сары</option>
                    <option value="green">Жасыл</option>
                </select>
            </div>

            {loading ? (
                <p style={S.muted}>Жүктелуде…</p>
            ) : (
                <div style={S.tableWrap}>
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={S.th}>Пациент</th>
                                <th style={S.th}>Аймақ</th>
                                <th style={S.th}>Балл</th>
                                <th style={S.th}>Ашық кейс</th>
                                <th style={S.th}>Психолог</th>
                                <th style={S.th}>Әрекет</th>
                            </tr>
                        </thead>
                        <tbody>
                            {patients.map((p) => (
                                <tr key={p.patient_id} style={S.tr}>
                                    <td style={S.td}>{p.patient_name || `#${p.patient_id}`}</td>
                                    <td style={S.td}>
                                        <span style={{ ...S.zoneTag, background: ZONE_COLORS[p.zone] || "#64748b" }}>
                                            {ZONE_LABELS[p.zone] || p.zone}
                                        </span>
                                    </td>
                                    <td style={S.td}>{p.score}</td>
                                    <td style={S.td}>{p.open_cases || 0}</td>
                                    <td style={S.td}>
                                        {p.psychologist_id ? (
                                            <span style={S.assignedName}>{p.psychologist_name || `#${p.psychologist_id}`}</span>
                                        ) : (
                                            <span style={S.unassigned}>— бекітілмеген —</span>
                                        )}
                                    </td>
                                    <td style={S.td}>
                                        <div style={S.actions}>
                                            <select
                                                style={S.selectSmall}
                                                value={selected[p.patient_id] || ""}
                                                onChange={(e) => setSelected((s) => ({ ...s, [p.patient_id]: e.target.value }))}
                                            >
                                                <option value="">Психолог таңдаңыз…</option>
                                                {psychologists.map((ps) => (
                                                    <option key={ps.id} value={ps.id}>{ps.full_name}</option>
                                                ))}
                                            </select>
                                            <button
                                                style={S.btnPrimary}
                                                disabled={busy === p.patient_id || !selected[p.patient_id]}
                                                onClick={() => handleAssign(p.patient_id)}
                                            >
                                                Бекіту
                                            </button>
                                            {p.psychologist_id && (
                                                <button
                                                    style={S.btnGhost}
                                                    disabled={busy === p.patient_id}
                                                    onClick={() => handleUnassign(p.patient_id)}
                                                >
                                                    Алу
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {patients.length === 0 && (
                                <tr>
                                    <td style={S.td} colSpan={6}><span style={S.muted}>Пациенттер жоқ.</span></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

const S = {
    page: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px" },
    headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    title: { fontSize: 26, fontWeight: 700, margin: 0, color: "#0f172a" },
    subtitle: { color: "#64748b", marginTop: 6, fontSize: 14 },
    muted: { color: "#94a3b8" },
    errorBanner: { background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 16px", borderRadius: 10 },
    msgBanner: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", padding: "10px 14px", borderRadius: 10, marginBottom: 12 },
    psychRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 },
    psychCard: { display: "flex", flexDirection: "column", padding: "10px 14px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 10, minWidth: 150 },
    psychName: { fontWeight: 600, color: "#6d28d9" },
    psychCount: { fontSize: 12, color: "#7c3aed" },
    filters: { display: "flex", gap: 10, marginBottom: 14 },
    select: { padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff" },
    selectSmall: { padding: "6px 8px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", maxWidth: 180 },
    tableWrap: { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
    th: { textAlign: "left", padding: "12px 14px", fontSize: 13, color: "#64748b", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" },
    tr: { borderBottom: "1px solid #f1f5f9" },
    td: { padding: "12px 14px", fontSize: 14, color: "#0f172a", verticalAlign: "middle" },
    zoneTag: { color: "#fff", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 },
    assignedName: { color: "#6d28d9", fontWeight: 600 },
    unassigned: { color: "#94a3b8", fontStyle: "italic" },
    actions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
    btnPrimary: { padding: "6px 14px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 600 },
    btnGhost: { padding: "6px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", cursor: "pointer" },
};
