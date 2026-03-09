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
    const [roles, setRoles] = useState({}); // { userId: "admin|doctor|patient|super_admin" }
    const [loading, setLoading] = useState(false);
    const [myRole, setMyRole] = useState(""); // "admin" | "super_admin"

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        const role = parseJwt(t)?.role;
        if (role !== "admin" && role !== "super_admin") {
            setMsg("Бұл бет тек admin немесе super_admin үшін.");
            return;
        }
        setMyRole(role === "super_admin" ? "super_admin" : "admin");
        load(role);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function load(callerRole) {
        setLoading(true);
        setMsg("");
        try {
            const data = await api("/api/v1/admin/users", { auth: true });
            const arr = Array.isArray(data) ? data : [];
            setList(arr);

            const map = {};
            arr.forEach((u) => (map[u.id] = (u.role || "patient").toLowerCase()));
            setRoles(map);

            if (arr.length === 0) setMsg(callerRole === "super_admin" ? "Дәрігер мен админ жоқ." : "Пациент пен дәрігер жоқ.");
        } catch (e) {
            setMsg(`Қате: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    async function saveRole(id) {
        try {
            const role = roles[id] || (myRole === "super_admin" ? "admin" : "patient");
            await api(`/api/v1/admin/users/${id}/role`, {
                method: "PUT",
                auth: true,
                body: { role },
            });
            alert("Рөл сақталды ✅");
            load(myRole);
        } catch (e) {
            alert(e.message || "Қате");
        }
    }

    const roleOptions = myRole === "super_admin"
        ? [
            { value: "patient", label: "patient" },
            { value: "doctor", label: "doctor" },
            { value: "admin", label: "admin" },
            { value: "super_admin", label: "super_admin" },
        ]
        : [
            // Қарапайым admin тек patient ↔ doctor ауыстыра алады
            { value: "patient", label: "patient" },
            { value: "doctor", label: "doctor" },
        ];

    // Топтар тек сақталған role бойынша бөлінеді (select өзгергенде бірден орнын ауыстырмау үшін).
    const effectiveRole = (u) => (u.role || (myRole === "super_admin" ? "admin" : "patient")).toLowerCase();
    const doctorUsers = list.filter((u) => effectiveRole(u) === "doctor");
    const otherUsers = list.filter((u) => effectiveRole(u) !== "doctor");

    const renderRows = (items) =>
        items.map((u) => (
            <tr key={u.id} className="admin-users-row">
                <td className="admin-users-id">{u.id}</td>
                <td className="admin-users-name">{u.full_name || ""}</td>
                <td className="admin-users-phone">{u.phone || ""}</td>
                <td className="admin-users-rolecell">
                    <select
                        className="input admin-users-role"
                        value={roles[u.id] || (myRole === "super_admin" ? "admin" : "patient")}
                        onChange={(e) => setRoles((p) => ({ ...p, [u.id]: e.target.value }))}
                    >
                        {roleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </td>
                <td className="admin-users-savecell">
                    <button className="btn success admin-users-savebtn" onClick={() => saveRole(u.id)}>
                        Сақтау
                    </button>
                </td>
            </tr>
        ));

    return (
        <div className="page admin-users-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">
                        {myRole === "super_admin" ? "Super Admin — Рөл басқару" : "Admin — Users (Рөл басқару)"}
                    </h2>
                    <p className="muted page-header__subtitle">
                        {myRole === "super_admin"
                            ? "Тек дәрігерлер мен админдер. Рөлді patient / doctor / admin / super_admin қоюға болады. Супер админдер тізімде көрінбейді."
                            : "Пациент пен дәрігерлер. Рөл: patient / doctor / admin өзгерту (super_admin қойылмайды)."}
                    </p>
                </div>
            </div>

            {msg && <p style={{ marginTop: 12, color: msg.includes("Қате") ? "#ef4444" : "#94a3b8" }}>{msg}</p>}
            {loading && <p className="muted">Жүктелуде...</p>}

            <div className="admin-users-layout">
                <div className="admin-users-column">
                    <h3 className="admin-users-column__title">Дәрігерлер</h3>
                    <div className="table-wrap admin-users-tablewrap">
                        <table className="table admin-users-table" style={{ minWidth: 480 }}>
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
                            {doctorUsers.length > 0 ? renderRows(doctorUsers) : (
                                <tr>
                                    <td colSpan={5} className="muted">Дәрігерлер жоқ.</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-users-column">
                    <h3 className="admin-users-column__title">
                        {myRole === "super_admin" ? "Админдер" : "Пациенттер"}
                    </h3>
                    <div className="table-wrap admin-users-tablewrap">
                        <table className="table admin-users-table" style={{ minWidth: 480 }}>
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
                            {otherUsers.length > 0 ? renderRows(otherUsers) : (
                                <tr>
                                    <td colSpan={5} className="muted">
                                        {myRole === "super_admin" ? "Админдер жоқ." : "Пациенттер жоқ."}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}