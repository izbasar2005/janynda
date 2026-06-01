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

const ROLE_LABELS = {
    patient: "Пациент",
    doctor: "Дәрігер",
    psychologist: "Психолог",
    head_psychologist: "Бас психолог",
    volunteer: "Волонтёр",
    admin: "Админ",
    super_admin: "Сүпер админ",
};
const ROLE_COLORS = {
    patient: "#0891b2",
    doctor: "#2563eb",
    psychologist: "#7c3aed",
    head_psychologist: "#9333ea",
    volunteer: "#16a34a",
    admin: "#d97706",
    super_admin: "#dc2626",
};

export default function AdminUsers() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [msg, setMsg] = useState("");
    const [roles, setRoles] = useState({});
    const [loading, setLoading] = useState(false);
    const [myRole, setMyRole] = useState("");
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [savingId, setSavingId] = useState(0);

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin" && role !== "super_admin") {
            setMsg("Бұл бет тек админ немесе сүпер админ үшін.");
            return;
        }
        setMyRole(role === "super_admin" ? "super_admin" : "admin");
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load() {
        setLoading(true);
        setMsg("");
        try {
            const data = await api("/api/v1/admin/users", { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setList(arr);
            const map = {};
            arr.forEach((u) => (map[u.id] = (u.role || "patient").toLowerCase()));
            setRoles(map);
            if (arr.length === 0) setMsg("Қолданушылар табылмады.");
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function saveRole(id) {
        setSavingId(id);
        try {
            const current = list.find((u) => u.id === id);
            const role = roles[id] || (current?.role || "patient").toLowerCase();
            await api(`/api/v1/admin/users/${id}/role`, { method: "PUT", auth: true, body: { role } });
            await load();
        } catch (e) {
            alert(e.message || "Қате");
        } finally {
            setSavingId(0);
        }
    }

    const roleOptions = myRole === "super_admin"
        ? ["patient", "doctor", "psychologist", "head_psychologist", "volunteer", "admin", "super_admin"]
        : ["patient", "doctor", "psychologist", "volunteer"];

    // Доступные роли-фильтры (только присутствующие в списке).
    const presentRoles = useMemo(() => {
        const set = new Set(list.map((u) => (u.role || "patient").toLowerCase()));
        const order = ["doctor", "psychologist", "head_psychologist", "admin", "super_admin", "patient", "volunteer"];
        return order.filter((r) => set.has(r));
    }, [list]);

    const counts = useMemo(() => {
        const c = {};
        for (const u of list) {
            const r = (u.role || "patient").toLowerCase();
            c[r] = (c[r] || 0) + 1;
        }
        return c;
    }, [list]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return list.filter((u) => {
            const r = (u.role || "patient").toLowerCase();
            if (roleFilter && r !== roleFilter) return false;
            if (!q) return true;
            return (
                (u.full_name || "").toLowerCase().includes(q) ||
                (u.phone || "").toLowerCase().includes(q) ||
                String(u.id).includes(q)
            );
        });
    }, [list, search, roleFilter]);

    return (
        <div style={S.page}>
            <div style={S.header}>
                <h1 style={S.title}>Қолданушылар</h1>
                <p style={S.subtitle}>
                    {myRole === "super_admin"
                        ? "Барлық қолданушылар мен олардың рөлдерін басқару."
                        : "Пациент, волонтёр, психолог және дәрігерлердің рөлдерін басқару."}
                </p>
            </div>

            {msg && <div style={msg.includes("Қате") ? S.errorBanner : S.infoBanner}>{msg}</div>}

            <div style={S.toolbar}>
                <input
                    style={S.search}
                    placeholder="Аты-жөні, телефон немесе ID бойынша іздеу…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div style={S.pills}>
                <Pill active={roleFilter === ""} onClick={() => setRoleFilter("")} label="Барлығы" count={list.length} color="#0f172a" />
                {presentRoles.map((r) => (
                    <Pill
                        key={r}
                        active={roleFilter === r}
                        onClick={() => setRoleFilter(r)}
                        label={ROLE_LABELS[r] || r}
                        count={counts[r] || 0}
                        color={ROLE_COLORS[r] || "#0f172a"}
                    />
                ))}
            </div>

            {loading && <p style={S.muted}>Жүктелуде…</p>}

            {!loading && (
                <div style={S.tableWrap}>
                    <table style={S.table}>
                        <thead>
                            <tr>
                                <th style={{ ...S.th, width: 60 }}>ID</th>
                                <th style={S.th}>Аты-жөні</th>
                                <th style={S.th}>Телефон</th>
                                <th style={S.th}>Ағымдағы рөл</th>
                                <th style={S.th}>Жаңа рөл</th>
                                <th style={{ ...S.th, width: 120 }}>Әрекет</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((u) => {
                                const cur = (u.role || "patient").toLowerCase();
                                const sel = roles[u.id] || cur;
                                const changed = sel !== cur;
                                return (
                                    <tr key={u.id} style={S.tr}>
                                        <td style={{ ...S.td, color: "#94a3b8", fontWeight: 600 }}>{u.id}</td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{u.full_name || "—"}</td>
                                        <td style={{ ...S.td, color: "#475569" }}>{u.phone || "—"}</td>
                                        <td style={S.td}>
                                            <span style={{ ...S.badge, background: (ROLE_COLORS[cur] || "#64748b") + "1a", color: ROLE_COLORS[cur] || "#64748b" }}>
                                                {ROLE_LABELS[cur] || cur}
                                            </span>
                                        </td>
                                        <td style={S.td}>
                                            <select
                                                style={S.select}
                                                value={sel}
                                                onChange={(e) => setRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                                            >
                                                {roleOptions.map((opt) => (
                                                    <option key={opt} value={opt}>{ROLE_LABELS[opt] || opt}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td style={S.td}>
                                            <button
                                                style={changed ? S.btnSave : S.btnSaveDisabled}
                                                disabled={!changed || savingId === u.id}
                                                onClick={() => saveRole(u.id)}
                                            >
                                                {savingId === u.id ? "…" : "Сақтау"}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td style={S.td} colSpan={6}><span style={S.muted}>Қолданушылар табылмады.</span></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Pill({ active, onClick, label, count, color }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                ...S.pill,
                ...(active ? { background: color, color: "#fff", borderColor: color } : {}),
            }}
        >
            {label}
            <span style={{ ...S.pillCount, ...(active ? { background: "rgba(255,255,255,0.25)", color: "#fff" } : {}) }}>
                {count}
            </span>
        </button>
    );
}

const S = {
    page: { maxWidth: 1040, margin: "0 auto", padding: "32px 24px 60px" },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 },
    subtitle: { fontSize: 14, color: "#64748b", marginTop: 4 },
    muted: { color: "#94a3b8", fontSize: 14 },
    errorBanner: { background: "#fef2f2", color: "#dc2626", borderRadius: 10, padding: "12px 16px", fontWeight: 600, fontSize: 14, marginBottom: 16 },
    infoBanner: { background: "#f1f5f9", color: "#475569", borderRadius: 10, padding: "12px 16px", fontSize: 14, marginBottom: 16 },

    toolbar: { marginBottom: 14 },
    search: {
        width: "100%",
        padding: "11px 16px",
        borderRadius: 10,
        border: "1px solid #cbd5e1",
        fontSize: 14,
        background: "#fff",
        boxSizing: "border-box",
    },

    pills: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 },
    pill: {
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "7px 14px", borderRadius: 999,
        border: "1px solid #e2e8f0", background: "#fff", color: "#475569",
        fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.12s",
    },
    pillCount: {
        minWidth: 20, padding: "1px 7px", borderRadius: 999,
        background: "#f1f5f9", color: "#64748b", fontSize: 12, fontWeight: 700, textAlign: "center",
    },

    tableWrap: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 720 },
    th: {
        textAlign: "left", padding: "12px 16px", fontSize: 12, fontWeight: 700,
        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em",
        borderBottom: "1px solid #e2e8f0", background: "#f8fafc",
    },
    tr: { borderBottom: "1px solid #f1f5f9" },
    td: { padding: "12px 16px", fontSize: 14, color: "#0f172a", verticalAlign: "middle" },
    badge: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 },
    select: { padding: "7px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, minWidth: 130 },
    btnSave: { padding: "7px 16px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 },
    btnSaveDisabled: { padding: "7px 16px", borderRadius: 8, border: "none", background: "#e2e8f0", color: "#94a3b8", fontWeight: 600, cursor: "default", fontSize: 13 },
};
