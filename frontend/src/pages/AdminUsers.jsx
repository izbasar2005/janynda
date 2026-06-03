import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, token } from "../services/api";
import TableWrap from "../components/ui/TableWrap";

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

    const msgClass = msg.includes("Қате") ? "admin-banner admin-banner--error" : "admin-banner admin-banner--info";

    return (
        <div className="page admin-users-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Қолданушылар</h2>
                    <p className="muted page-header__subtitle">
                        {myRole === "super_admin"
                            ? "Барлық қолданушылар мен олардың рөлдерін басқару."
                            : "Пациент, волонтёр, психолог және дәрігерлердің рөлдерін басқару."}
                    </p>
                </div>
            </div>

            {msg && <div className={msgClass}>{msg}</div>}

            <div className="admin-users-toolbar">
                <input
                    className="admin-users-search"
                    type="search"
                    placeholder="Аты-жөні, телефон немесе ID бойынша іздеу…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="admin-users-pills" role="tablist" aria-label="Рөл фильтрі">
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

            {loading && <p className="muted">Жүктелуде…</p>}

            {!loading && (
                <>
                    <div className="admin-mobile-cards" aria-label="Қолданушылар">
                        {filtered.map((u) => {
                            const cur = (u.role || "patient").toLowerCase();
                            const sel = roles[u.id] || cur;
                            const changed = sel !== cur;
                            const color = ROLE_COLORS[cur] || "#64748b";
                            return (
                                <article key={u.id} className="card admin-mobile-card">
                                    <header className="admin-mobile-card__head">
                                        <div>
                                            <h3 className="admin-mobile-card__title">{u.full_name || "—"}</h3>
                                            <p className="admin-mobile-card__meta">
                                                ID {u.id} · {u.phone || "—"}
                                            </p>
                                        </div>
                                        <span
                                            className="admin-mobile-card__badge"
                                            style={{ background: `${color}1a`, color }}
                                        >
                                            {ROLE_LABELS[cur] || cur}
                                        </span>
                                    </header>
                                    <div className="admin-mobile-card__fields">
                                        <div className="admin-mobile-card__field">
                                            <label htmlFor={`role-${u.id}`}>Жаңа рөл</label>
                                            <select
                                                id={`role-${u.id}`}
                                                className="input"
                                                value={sel}
                                                onChange={(e) => setRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                                            >
                                                {roleOptions.map((opt) => (
                                                    <option key={opt} value={opt}>{ROLE_LABELS[opt] || opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="admin-mobile-card__actions">
                                        <button
                                            type="button"
                                            className="btn"
                                            disabled={!changed || savingId === u.id}
                                            onClick={() => saveRole(u.id)}
                                        >
                                            {savingId === u.id ? "Сақталуда…" : "Сақтау"}
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                        {filtered.length === 0 && (
                            <p className="muted">Қолданушылар табылмады.</p>
                        )}
                    </div>

                    <div className="admin-users-table-view admin-desktop-table">
                        <TableWrap className="admin-users-tablewrap">
                            <table className="table admin-users-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 60 }}>ID</th>
                                        <th>Аты-жөні</th>
                                        <th>Телефон</th>
                                        <th>Ағымдағы рөл</th>
                                        <th>Жаңа рөл</th>
                                        <th style={{ width: 120 }}>Әрекет</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((u) => {
                                        const cur = (u.role || "patient").toLowerCase();
                                        const sel = roles[u.id] || cur;
                                        const changed = sel !== cur;
                                        const color = ROLE_COLORS[cur] || "#64748b";
                                        return (
                                            <tr key={u.id} className="admin-users-row">
                                                <td style={{ color: "#94a3b8", fontWeight: 600 }}>{u.id}</td>
                                                <td className="admin-users-name">{u.full_name || "—"}</td>
                                                <td className="admin-users-phone">{u.phone || "—"}</td>
                                                <td>
                                                    <span
                                                        className="admin-mobile-card__badge"
                                                        style={{ background: `${color}1a`, color }}
                                                    >
                                                        {ROLE_LABELS[cur] || cur}
                                                    </span>
                                                </td>
                                                <td className="admin-users-rolecell">
                                                    <select
                                                        className="input admin-users-role"
                                                        value={sel}
                                                        onChange={(e) => setRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                                                    >
                                                        {roleOptions.map((opt) => (
                                                            <option key={opt} value={opt}>{ROLE_LABELS[opt] || opt}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="admin-users-savecell">
                                                    <button
                                                        type="button"
                                                        className="btn admin-users-savebtn"
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
                                            <td colSpan={6} className="muted">Қолданушылар табылмады.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </TableWrap>
                    </div>
                </>
            )}
        </div>
    );
}

function Pill({ active, onClick, label, count, color }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`admin-users-pill${active ? " is-active" : ""}`}
            style={active ? { background: color, borderColor: color } : undefined}
            aria-pressed={active}
        >
            {label}
            <span className="admin-users-pill__count">{count}</span>
        </button>
    );
}
