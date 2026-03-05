import { useEffect, useState } from "react";
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

export default function AdminUsers() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [msg, setMsg] = useState("");
    const [roles, setRoles] = useState({}); // { userId: "admin|doctor|patient" }
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin") {
            setMsg("Бұл бет тек admin үшін.");
            return;
        }
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
            arr.forEach((u) => (map[u.id] = u.role || "patient"));
            setRoles(map);

            if (arr.length === 0) setMsg("User жоқ.");
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function saveRole(id) {
        try {
            const role = roles[id] || "patient";
            await api(`/api/v1/admin/users/${id}/role`, {
                method: "PUT",
                auth: true,
                body: { role },
            });
            alert("Role сақталды ✅");
            load();
        } catch (e) {
            alert(`Қате: ${e.message}`);
        }
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Admin — Users (Role басқару)</h2>
                    <p className="muted page-header__subtitle">
                        Пайдаланушылардың рөлдерін (patient / doctor / admin) қауіпсіз түрде өзгертіңіз.
                    </p>
                </div>
            </div>

            <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                    Бұл бет admin token-мен жұмыс істейді: <b>GET /api/v1/admin/users</b>,{" "}
                    <b>PUT /api/v1/admin/users/{`{id}`}/role</b>
                </p>
            </div>

            {msg && <p style={{ marginTop: 12, color: msg.includes("Қате") ? "#ef4444" : "#94a3b8" }}>{msg}</p>}
            {loading && <p className="muted">Жүктелуде...</p>}

            <div className="table-wrap">
                <table className="table" style={{ minWidth: 980 }}>
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Аты-жөні</th>
                        <th>Телефон</th>
                        <th>Role</th>
                        <th>Сақтау</th>
                    </tr>
                    </thead>

                    <tbody>
                    {list.map((u) => (
                        <tr key={u.id}>
                            <td>{u.id}</td>
                            <td>{u.full_name || ""}</td>
                            <td>{u.phone || ""}</td>
                            <td style={{ minWidth: 180 }}>
                                <select
                                    className="input"
                                    value={roles[u.id] || "patient"}
                                    onChange={(e) => setRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                                >
                                    <option value="patient">patient</option>
                                    <option value="doctor">doctor</option>
                                    <option value="admin">admin</option>
                                </select>
                            </td>
                            <td style={{ minWidth: 140 }}>
                                <button className="btn success" onClick={() => saveRole(u.id)}>
                                    Save
                                </button>
                            </td>
                        </tr>
                    ))}
                    {list.length === 0 && !loading && (
                        <tr>
                            <td colSpan={5} className="muted">
                                Тізім бос.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}