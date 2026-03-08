import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { api, token } from "../services/api";

function fmtStartAt(s) {
    if (!s) return { date: "—", time: "", full: "—" };
    try {
        const d = new Date(s);
        const date = d.toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
        const time = d.toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
        return { date, time, full: d.toLocaleString("kk-KZ") };
    } catch {
        return { date: String(s), time: "", full: String(s) };
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

/** Кездесуге 30 минуттан көп қалды ма (отмена батырмасы көрсету үшін) */
function canCancelByPatient(startAt) {
    if (!startAt) return false;
    try {
        const start = new Date(startAt).getTime();
        return start - Date.now() > 30 * 60 * 1000;
    } catch {
        return false;
    }
}

function getInitials(name) {
    if (!name || typeof name !== "string") return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || "?").toUpperCase();
}

function fmtDate(s) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return String(s);
    }
}

function genderLabel(g) {
    if (!g) return "—";
    const v = (g + "").toLowerCase();
    if (v === "male" || v === "m" || v === "ер") return "Ер адам";
    if (v === "female" || v === "f" || v === "әйел") return "Әйел адам";
    return g;
}

function statusLabel(s, isPast = false) {
    const v = (s || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "Бас тартылды";
    if (isPast) return "Өтті";
    if (v === "pending") return "Күтуде";
    if (v === "approved") return "Расталды";
    if (v === "done") return "Аяқталды";
    return s || "—";
}

export default function Profile() {
    const nav = useNavigate();
    const location = useLocation();
    const [me, setMe] = useState(null);
    const [apps, setApps] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [msg, setMsg] = useState("");
    const [cancellingId, setCancellingId] = useState(null);

    function fetchAppointments() {
        if (!token()) return;
        api("/api/v1/appointments/my", { auth: true })
            .then((d) => setApps(Array.isArray(d) ? d : []))
            .catch(() => setApps([]));
    }

    useEffect(() => {
        const t = token();
        if (!t) {
            nav("/login");
            return;
        }
        setMsg("");
        api("/api/v1/me", { auth: true })
            .then((u) => {
                setMe(u);
                if (u?.role === "admin") {
                    setApps([]);
                    return;
                }
                if (u?.role === "super_admin") {
                    setApps([]);
                    api("/api/v1/admin/dashboard/stats", { auth: true })
                        .then((d) => setDashboardStats(d))
                        .catch(() => setDashboardStats(null));
                    return;
                }
                fetchAppointments();
            })
            .catch((e) => setMsg("Қате: " + e.message));
    }, [nav]);

    // Жазылулар тізімін жаңарту: бетке кіргенде немесе жазылудан қайтқанда (state.fromBook)
    useEffect(() => {
        if (!me || me?.role === "admin" || me?.role === "super_admin") return;
        if (location.state?.fromBook === true) {
            fetchAppointments();
            nav(location.pathname, { replace: true, state: {} });
        }
    }, [me, location.state?.fromBook]);

    async function cancelAppointment(id) {
        setCancellingId(id);
        setMsg("");
        try {
            await api(`/api/v1/appointments/${id}/cancel`, { method: "PATCH", auth: true });
            setApps((prev) => prev.map((a) => (Number(a.id) === Number(id) ? { ...a, status: "canceled" } : a)));
        } catch (e) {
            setMsg(e.message || "Қате");
        } finally {
            setCancellingId(null);
        }
    }

    const isAdmin = me?.role === "admin";
    const isSuperAdmin = me?.role === "super_admin";
    const displayName = me?.full_name || [me?.first_name, me?.last_name].filter(Boolean).join(" ") || me?.name || "Пациент";

    const sortedApps = useMemo(() => {
        const getTime = (a) => {
            const raw = a?.start_at ?? a?.startAt ?? a?.StartAt;
            const t = new Date(raw).getTime();
            return Number.isNaN(t) ? 0 : t;
        };
        return [...apps].sort((a, b) => getTime(b) - getTime(a));
    }, [apps]);

    const infoRows = [];
    if (me) {
        if (displayName) infoRows.push({ label: "Аты-жөні", value: displayName });
        infoRows.push({ label: "Рөлі", value: me.role === "doctor" ? "Дәрігер" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : "Пациент" });
        if (me.phone) infoRows.push({ label: "Телефон", value: me.phone });
        if (me.iin) infoRows.push({ label: "ЖСН", value: me.iin });
        if (me.first_name) infoRows.push({ label: "Аты", value: me.first_name });
        if (me.last_name) infoRows.push({ label: "Тегі", value: me.last_name });
        if (me.patronymic) infoRows.push({ label: "Әкесінің аты", value: me.patronymic });
        if (me.gender) infoRows.push({ label: "Жынысы", value: genderLabel(me.gender) });
        if (me.created_at) infoRows.push({ label: "Тіркелген", value: fmtDate(me.created_at) });
    }

    return (
        <div className="page profile-page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Менің профилім</h2>
                    <p className="muted page-header__subtitle">
                        Жеке деректеріңіз бен дәрігерге жазылулар тізімі.
                    </p>
                </div>
            </div>

            {msg && <p className="form-error">{msg}</p>}

            {!me ? (
                <div className="card profile-card">
                    <p className="muted">Жүктелуде...</p>
                </div>
            ) : (
                <>
                    {/* Hero: аватар + аты + рөл */}
                    <div className="profile-hero">
                        <div className="profile-hero__avatar" aria-hidden="true">
                            {getInitials(displayName)}
                        </div>
                        <div className="profile-hero__info">
                            <h1 className="profile-hero__name">{displayName}</h1>
                            <span className={`profile-hero__role profile-hero__role--${me.role || "patient"}`}>
                                {me.role === "doctor" ? "Дәрігер" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : "Пациент"}
                            </span>
                        </div>
                    </div>

                    <div className="profile-layout">
                        {/* Жеке деректер карточкасы */}
                        <section className="profile-card profile-card--info">
                            <h3 className="profile-card__title">Жеке деректер</h3>
                            <dl className="profile-info">
                                {infoRows.length > 0 ? (
                                    infoRows.map((row) => (
                                        <div key={row.label} className="profile-info__row">
                                            <dt className="profile-info__label">{row.label}</dt>
                                            <dd className="profile-info__value">{row.value}</dd>
                                        </div>
                                    ))
                                ) : (
                                    <div className="profile-info__row">
                                        <dt className="profile-info__label">Аты-жөні</dt>
                                        <dd className="profile-info__value">{displayName}</dd>
                                    </div>
                                )}
                            </dl>
                        </section>

                        {/* Жазылулар / Super Admin: статистика */}
                        <section className="profile-card profile-card--appointments">
                            {isSuperAdmin ? (
                                <>
                                    <h3 className="profile-card__title">Жалпы статистика</h3>
                                    {dashboardStats ? (
                                        <>
                                            <div className="admin-dashboard-cards" style={{ marginTop: 12 }}>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Users</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.users ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Қолданушылар</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Doctors</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.doctors ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Дәрігерлер</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Appointments</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.appointments ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Жазылулар</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Reviews</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.reviews ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Пікірлер</p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="muted">Статистика жүктелуде...</p>
                                    )}
                                </>
                            ) : (
                                <>
                            <h3 className="profile-card__title">Жазылуларым</h3>

                            {isAdmin ? (
                                <div className="profile-empty">
                                    <span className="profile-empty__icon" aria-hidden="true">👤</span>
                                    <p className="profile-empty__title">Admin аккаунт</p>
                                    <p className="profile-empty__text">Пациент жазылулары бұл аккаунтта көрсетілмейді.</p>
                                </div>
                            ) : apps.length === 0 ? (
                                <div className="profile-empty">
                                    <span className="profile-empty__icon" aria-hidden="true">📅</span>
                                    <p className="profile-empty__title">Әзірге жазылу жоқ</p>
                                    <p className="profile-empty__text">
                                        Дәрігерлер тізімінен маманды таңдап, ыңғайлы уақытты белгілеңіз.
                                    </p>
                                    <Link to="/doctors" className="btn profile-empty__cta">Дәрігерлерге өту</Link>
                                </div>
                            ) : (
                                <ul className="profile-appointments">
                                    {sortedApps.map((a) => {
                                        const startAt = a.start_at ?? a.startAt ?? a.StartAt;
                                        const status = a.status ?? a.Status ?? "—";
                                        const doctorName = (a.doctor?.full_name || a.doctor?.FullName) ?? "—";
                                        const patientName = (a.patient?.full_name || a.patient?.FullName) ?? "—";
                                        const { date, time, full } = fmtStartAt(startAt);
                                        const isPast = isPastAppointment(startAt);
                                        const who = me?.role === "doctor" ? patientName : doctorName;
                                        const whoLabel = me?.role === "doctor" ? "Пациент" : "Дәрігер";
                                        const canCancel = me?.role === "patient" && !isPast && canCancelByPatient(startAt) && status !== "canceled" && status !== "cancelled";

                                        return (
                                            <li
                                                key={a.id}
                                                className={`profile-appointment ${isPast ? "profile-appointment--past" : ""}`}
                                            >
                                                <div className="profile-appointment__main">
                                                    <div className="profile-appointment__date-block">
                                                        <span className="profile-appointment__date">{date}</span>
                                                        {time && <span className="profile-appointment__time">{time}</span>}
                                                    </div>
                                                    <div className="profile-appointment__details">
                                                        <p className="profile-appointment__label">{whoLabel}</p>
                                                        <p className="profile-appointment__name">{who}</p>
                                                    </div>
                                                    <span className={`profile-appointment__status profile-appointment__status--${isPast ? "past" : (status || "").toLowerCase()}`}>
                                                        {statusLabel(status, isPast)}
                                                    </span>
                                                </div>
                                                {canCancel && (
                                                    <button
                                                        type="button"
                                                        className="btn profile-appointment__cancel"
                                                        onClick={() => cancelAppointment(a.id)}
                                                        disabled={cancellingId === a.id}
                                                    >
                                                        {cancellingId === a.id ? "..." : "Отмена"}
                                                    </button>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                                </>
                            )}
                        </section>
                    </div>
                </>
            )}
        </div>
    );
}
