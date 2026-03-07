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

function isPastAppointment(startAt) {
    if (!startAt) return false;
    try {
        return new Date(startAt).getTime() < Date.now();
    } catch {
        return false;
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
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Профиль</h2>
                    <p className="muted page-header__subtitle">
                        Жеке деректеріңіз бен жазылуларыңыздың қысқаша көрінісі.
                    </p>
                </div>
            </div>

            {msg && <p className="form-error">{msg}</p>}

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
                    <div className="empty-state">
                        <h4 className="empty-state__title">Admin аккаунт</h4>
                        <p className="empty-state__text">Admin аккаунтта пациент жазылулары көрсетілмейді.</p>
                    </div>
                ) : apps.length === 0 ? (
                    <div className="empty-state">
                        <h4 className="empty-state__title">Әзірге жазылу жоқ</h4>
                        <p className="empty-state__text">
                            Дәрігерге жазылу үшін дәрігерлер тізімінен маманды таңдап, ыңғайлы уақытты белгілеңіз.
                        </p>
                    </div>
                ) : (
                    <ul>
                        {apps.map((a) => {
                            const startAt = a.start_at ?? a.startAt ?? a.StartAt;
                            const status = a.status ?? a.Status ?? "—";

                            const doctorName = a.doctor?.full_name || a.doctor?.FullName;
                            const patientName = a.patient?.full_name || a.patient?.FullName;

                            const who =
                                me?.role === "doctor"
                                    ? `Пациент: ${patientName ?? "—"}`
                                    : `Дәрігер: ${doctorName ?? "—"}`;

                            return (
                                <li
                                    key={a.id}
                                    className={isPastAppointment(startAt) ? "profile-appointment profile-appointment--past" : "profile-appointment"}
                                >
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