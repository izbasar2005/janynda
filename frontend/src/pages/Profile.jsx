import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

function fmtStartAt(s) {
    if (!s) return "—";
    try {
        const d = new Date(s);
        return d.toLocaleString();
    } catch {
        return String(s);
    }
}

export default function Profile() {
    const nav = useNavigate();
    const [me, setMe] = useState(null);
    const [apps, setApps] = useState([]);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }

        setMsg("");

        // 1) алдымен /me аламыз
        api("/api/v1/me", { auth: true })
            .then((u) => {
                setMe(u);

                // ✅ admin болса — appointments сұрамаймыз (403 болмайды)
                if (u?.role === "admin") {
                    setApps([]);
                    return;
                }

                // ✅ admin емес болса ғана "my appointments" аламыз
                api("/api/v1/appointments/my", { auth: true })
                    .then((d) => setApps(Array.isArray(d) ? d : []))
                    .catch(() => setApps([])); // мұнда msg шығармаймыз
            })
            .catch((e) => {
                setMsg("Қате: " + e.message);
            });
    }, [nav]);

    const isAdmin = me?.role === "admin";

    return (
        <div style={{ marginTop: 24 }}>
            <h2>Профиль</h2>

            {msg && <p style={{ color: "#ef4444" }}>{msg}</p>}

            <div className="card" style={{ maxWidth: 900 }}>
                {me ? (
                    <>
                        <p style={{ marginTop: 0 }}>
                            <b>{me.full_name || me.name}</b>
                        </p>
                        <p className="muted" style={{ marginTop: 0 }}>
                            Role: {me.role}
                        </p>
                    </>
                ) : (
                    <p className="muted">Жүктелуде...</p>
                )}

                <h3 style={{ marginTop: 18 }}>Менің жазылуларым</h3>

                {isAdmin ? (
                    <p className="muted">Admin аккаунтта жазылулар көрсетілмейді.</p>
                ) : apps.length === 0 ? (
                    <p className="muted">Әзірге жазылу жоқ.</p>
                ) : (
                    <ul>
                        {apps.map((a) => {
                            const startAt = a.start_at ?? a.startAt ?? a.StartAt;
                            const status = a.status ?? a.Status ?? "—";

                            // patient/doctor аты (backend қайтаруына қарай)
                            const doctorName = a.doctor?.full_name || a.doctor?.FullName;
                            const patientName = a.patient?.full_name || a.patient?.FullName;

                            // doctor кірсе -> пациент көрсетеміз, patient кірсе -> дәрігер көрсетеміз
                            const who =
                                me?.role === "doctor"
                                    ? `Пациент: ${patientName ?? "—"}`
                                    : `Дәрігер: ${doctorName ?? "—"}`;

                            return (
                                <li key={a.id}>
                                    #{a.id} — {who} — {fmtStartAt(startAt)} — status: {status}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}