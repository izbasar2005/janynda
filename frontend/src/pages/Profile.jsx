import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { api, token } from "../services/api";
import { appointmentStatusLabel } from "../utils/appointmentStatus";

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

export default function Profile() {
    const nav = useNavigate();
    const location = useLocation();
    const [me, setMe] = useState(null);
    const [apps, setApps] = useState([]);
    const [referrals, setReferrals] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [msg, setMsg] = useState("");
    const [cancellingId, setCancellingId] = useState(null);
    const [showAllApps, setShowAllApps] = useState(false);

    const [topAlert, setTopAlert] = useState(null); // { type: "success" | "error", text: string }
    const topAlertTimer = useRef(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editMsg, setEditMsg] = useState("");
    const [editForm, setEditForm] = useState({
        full_name: "",
        phone: "",
        avatar_url: "",
        iin: "",
        first_name: "",
        last_name: "",
        patronymic: "",
        gender: "",
    });

    const [avatarUploading, setAvatarUploading] = useState(false);

    const [pwdOpen, setPwdOpen] = useState(false);
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdMsg, setPwdMsg] = useState("");
    const [pwdForm, setPwdForm] = useState({ old_password: "", new_password: "", confirm: "" });
    const [pwdShow, setPwdShow] = useState({ old: false, next: false, confirm: false });

    function showTopAlert(type, text) {
        setTopAlert({ type, text });
        try {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
            window.scrollTo(0, 0);
        }
        if (topAlertTimer.current) window.clearTimeout(topAlertTimer.current);
        topAlertTimer.current = window.setTimeout(() => setTopAlert(null), 3500);
    }

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
        setEditMsg("");
        setPwdMsg("");
        api("/api/v1/me", { auth: true })
            .then((u) => {
                setMe(u);
                setEditForm({
                    full_name: u?.full_name ?? "",
                    phone: u?.phone ?? "",
                    avatar_url: u?.avatar_url ?? "",
                    iin: u?.iin ?? "",
                    first_name: u?.first_name ?? "",
                    last_name: u?.last_name ?? "",
                    patronymic: u?.patronymic ?? "",
                    gender: u?.gender ?? "",
                });
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
                api("/api/v1/referrals/my", { auth: true })
                    .then((d) => setReferrals(Array.isArray(d) ? d : []))
                    .catch(() => setReferrals([]));
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

    async function saveProfile() {
        setEditSaving(true);
        setEditMsg("");
        try {
            const payload = {
                full_name: editForm.full_name,
                phone: editForm.phone,
                avatar_url: editForm.avatar_url,
                iin: editForm.iin,
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                patronymic: editForm.patronymic,
                gender: editForm.gender,
            };
            const u = await api("/api/v1/me", { method: "PATCH", auth: true, body: payload });
            setMe(u);
            showTopAlert("success", "Деректер сәтті сақталды");
            setEditOpen(false);
        } catch (e) {
            setEditMsg(e.message || "Қате");
            showTopAlert("error", e.message || "Қате");
        } finally {
            setEditSaving(false);
        }
    }

    async function uploadAvatar(file) {
        if (!file) return;
        setAvatarUploading(true);
        setEditMsg("");
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/v1/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
                body: fd,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
            const data = JSON.parse(text);
            setEditForm((p) => ({ ...p, avatar_url: data?.url || "" }));
            showTopAlert("success", "Аватар жүктелді");
        } catch (e) {
            setEditMsg(e.message || "Қате");
            showTopAlert("error", e.message || "Қате");
        } finally {
            setAvatarUploading(false);
        }
    }

    async function changePassword() {
        setPwdSaving(true);
        setPwdMsg("");
        try {
            if (!pwdForm.old_password || !pwdForm.new_password) {
                setPwdMsg("Ескі және жаңа парольді толтырыңыз");
                return;
            }
            if (pwdForm.new_password.length < 6) {
                setPwdMsg("Жаңа пароль кемінде 6 таңба болуы керек");
                return;
            }
            if (pwdForm.new_password !== pwdForm.confirm) {
                setPwdMsg("Қайта енгізілген пароль сәйкес емес");
                return;
            }
            await api("/api/v1/me/password", {
                method: "PATCH",
                auth: true,
                body: { old_password: pwdForm.old_password, new_password: pwdForm.new_password },
            });
            showTopAlert("success", "Пароль сәтті өзгертілді");
            setPwdForm({ old_password: "", new_password: "", confirm: "" });
            setPwdShow({ old: false, next: false, confirm: false });
            setPwdOpen(false);
        } catch (e) {
            setPwdMsg(e.message || "Қате");
            showTopAlert("error", e.message || "Қате");
        } finally {
            setPwdSaving(false);
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

    const hasMoreApps = sortedApps.length > 5;
    const visibleApps = showAllApps ? sortedApps : sortedApps.slice(0, 5);

    /** Соңғы жазылуда (уақыт бойынша) диагноз немесе дәрігер жазбасы толтырылған жазылу */
    const latestAppointmentWithMed = useMemo(() => {
        if (me?.role !== "patient") return null;
        for (const a of sortedApps) {
            if (a.diagnosis || a.clinical_notes) return a;
        }
        return null;
    }, [sortedApps, me?.role]);

    const infoRows = [];
    if (me) {
        if (displayName) infoRows.push({ label: "Аты-жөні", value: displayName });
        infoRows.push({ label: "Рөлі", value: me.role === "doctor" ? "Дәрігер" : me.role === "psychologist" ? "Психолог" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : me.role === "volunteer" ? "Волонтёр" : "Пациент" });
        if (me.phone) infoRows.push({ label: "Телефон", value: me.phone });
        if (me.iin) infoRows.push({ label: "ЖСН", value: me.iin });
        if (me.first_name) infoRows.push({ label: "Аты", value: me.first_name });
        if (me.last_name) infoRows.push({ label: "Тегі", value: me.last_name });
        if (me.patronymic) infoRows.push({ label: "Әкесінің аты", value: me.patronymic });
        if (me.gender) infoRows.push({ label: "Жынысы", value: genderLabel(me.gender) });
        if (me.diagnosis) infoRows.push({ label: "Диагноз", value: me.diagnosis });
        if (me.created_at) infoRows.push({ label: "Тіркелген", value: fmtDate(me.created_at) });
    }

    return (
        <div className="page profile-page">
            {topAlert && (
                <div className="doctor-save-toast" role="alert" aria-live="polite">
                    <div className="doctor-save-toast__box">
                        <span className="doctor-save-toast__icon" aria-hidden="true">
                            {topAlert.type === "success" ? "✓" : "⚠"}
                        </span>
                        <div className="doctor-save-toast__main">
                            <p
                                className="doctor-save-toast__title"
                                style={topAlert.type === "error" ? { color: "#b91c1c" } : undefined}
                            >
                                {topAlert.text}
                            </p>
                        </div>
                        <button
                            type="button"
                            className="doctor-save-toast__close"
                            aria-label="Жабу"
                            onClick={() => {
                                if (topAlertTimer.current) {
                                    clearTimeout(topAlertTimer.current);
                                    topAlertTimer.current = null;
                                }
                                setTopAlert(null);
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}
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
                            {me?.avatar_url ? (
                                <img
                                    src={me.avatar_url}
                                    alt=""
                                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }}
                                />
                            ) : (
                                getInitials(displayName)
                            )}
                        </div>
                        <div className="profile-hero__info">
                            <h1 className="profile-hero__name">{displayName}</h1>
                            <span className={`profile-hero__role profile-hero__role--${me.role || "patient"}`}>
                                {me.role === "doctor" ? "Дәрігер" : me.role === "psychologist" ? "Психолог" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : me.role === "volunteer" ? "Волонтёр" : "Пациент"}
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

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                                <button type="button" className="btn" onClick={() => { setEditOpen((v) => !v); setPwdOpen(false); }}>
                                    Деректерді өзгерту
                                </button>
                                <button type="button" className="btn" onClick={() => { setPwdOpen((v) => !v); setEditOpen(false); }}>
                                    Пароль өзгерту
                                </button>
                            </div>

                            {editOpen && (
                                <div style={{ marginTop: 14 }}>
                                    <div className="form-row">
                                        <label className="form-label">Аватар</label>
                                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                                            <div
                                                aria-hidden="true"
                                                style={{
                                                    width: 52,
                                                    height: 52,
                                                    borderRadius: 999,
                                                    background: "rgba(15,23,42,.06)",
                                                    border: "1px solid rgba(15,23,42,.08)",
                                                    overflow: "hidden",
                                                    display: "grid",
                                                    placeItems: "center",
                                                    color: "#0f172a",
                                                    fontWeight: 800,
                                                }}
                                            >
                                                {editForm.avatar_url ? (
                                                    <img src={editForm.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                ) : (
                                                    getInitials(displayName)
                                                )}
                                            </div>
                                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    onChange={(e) => uploadAvatar(e.target.files?.[0])}
                                                    disabled={avatarUploading || editSaving}
                                                />
                                                {editForm.avatar_url && (
                                                    <button
                                                        type="button"
                                                        className="btn ghost"
                                                        onClick={() => setEditForm((p) => ({ ...p, avatar_url: "" }))}
                                                        disabled={avatarUploading || editSaving}
                                                    >
                                                        Өшіру
                                                    </button>
                                                )}
                                                {avatarUploading && <span className="muted">Жүктелуде...</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Аты-жөні</label>
                                        <input
                                            className="input"
                                            value={editForm.full_name}
                                            onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                                            placeholder="Мысалы: Асанов Асқар"
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Телефон</label>
                                        <input
                                            className="input"
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                                            placeholder="+7..."
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">ЖСН</label>
                                        <input
                                            className="input"
                                            value={editForm.iin}
                                            onChange={(e) => setEditForm((p) => ({ ...p, iin: e.target.value }))}
                                        />
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                                        <div className="form-row">
                                            <label className="form-label">Аты</label>
                                            <input
                                                className="input"
                                                value={editForm.first_name}
                                                onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))}
                                            />
                                        </div>
                                        <div className="form-row">
                                            <label className="form-label">Тегі</label>
                                            <input
                                                className="input"
                                                value={editForm.last_name}
                                                onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Әкесінің аты</label>
                                        <input
                                            className="input"
                                            value={editForm.patronymic}
                                            onChange={(e) => setEditForm((p) => ({ ...p, patronymic: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Жынысы</label>
                                        <select
                                            className="input"
                                            value={editForm.gender}
                                            onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}
                                        >
                                            <option value="">—</option>
                                            <option value="male">Ер адам</option>
                                            <option value="female">Әйел адам</option>
                                        </select>
                                    </div>
                                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                                        <button type="button" className="btn" onClick={saveProfile} disabled={editSaving}>
                                            {editSaving ? "Сақталуда..." : "Сақтау"}
                                        </button>
                                        <button type="button" className="btn" onClick={() => setEditOpen(false)} disabled={editSaving}>
                                            Жабу
                                        </button>
                                    </div>
                                </div>
                            )}

                            {pwdOpen && (
                                <div style={{ marginTop: 14 }}>
                                    <div className="form-row">
                                        <label className="form-label">Ескі пароль</label>
                                        <div style={{ position: "relative" }}>
                                            <input
                                                className="input"
                                                type={pwdShow.old ? "text" : "password"}
                                                value={pwdForm.old_password}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, old_password: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPwdShow((s) => ({ ...s, old: !s.old }))}
                                                aria-label={pwdShow.old ? "Парольді жасыру" : "Парольді көрсету"}
                                                style={{
                                                    position: "absolute",
                                                    right: 8,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    padding: 6,
                                                    height: 34,
                                                    width: 34,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    lineHeight: "22px",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#111",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                👁
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Жаңа пароль</label>
                                        <div style={{ position: "relative" }}>
                                            <input
                                                className="input"
                                                type={pwdShow.next ? "text" : "password"}
                                                value={pwdForm.new_password}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, new_password: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPwdShow((s) => ({ ...s, next: !s.next }))}
                                                aria-label={pwdShow.next ? "Парольді жасыру" : "Парольді көрсету"}
                                                style={{
                                                    position: "absolute",
                                                    right: 8,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    padding: 6,
                                                    height: 34,
                                                    width: 34,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    lineHeight: "22px",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#111",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                👁
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Қайталау</label>
                                        <div style={{ position: "relative" }}>
                                            <input
                                                className="input"
                                                type={pwdShow.confirm ? "text" : "password"}
                                                value={pwdForm.confirm}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setPwdShow((s) => ({ ...s, confirm: !s.confirm }))}
                                                aria-label={pwdShow.confirm ? "Парольді жасыру" : "Парольді көрсету"}
                                                style={{
                                                    position: "absolute",
                                                    right: 8,
                                                    top: "50%",
                                                    transform: "translateY(-50%)",
                                                    padding: 6,
                                                    height: 34,
                                                    width: 34,
                                                    display: "grid",
                                                    placeItems: "center",
                                                    lineHeight: "22px",
                                                    background: "transparent",
                                                    border: "none",
                                                    color: "#111",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                👁
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                                        <button type="button" className="btn" onClick={changePassword} disabled={pwdSaving}>
                                            {pwdSaving ? "..." : "Өзгерту"}
                                        </button>
                                        <button type="button" className="btn" onClick={() => setPwdOpen(false)} disabled={pwdSaving}>
                                            Жабу
                                        </button>
                                    </div>
                                </div>
                            )}
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

                            {me?.role === "patient" && latestAppointmentWithMed ? (
                                <div className="profile-latest-med">
                                    {latestAppointmentWithMed.diagnosis ? (
                                        <div className="profile-latest-med__block">
                                            <div className="profile-latest-med__h">Диагноз</div>
                                            <div className="profile-latest-med__body">{latestAppointmentWithMed.diagnosis}</div>
                                        </div>
                                    ) : null}
                                    {latestAppointmentWithMed.clinical_notes ? (
                                        <div className="profile-latest-med__block">
                                            <div className="profile-latest-med__h">Дәрігер жазбасы</div>
                                            <div className="profile-latest-med__body">{latestAppointmentWithMed.clinical_notes}</div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}

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
                                <>
                                    <ul className="profile-appointments">
                                        {visibleApps.map((a) => {
                                            const startAt = a.start_at ?? a.startAt ?? a.StartAt;
                                            const status = a.status ?? a.Status ?? "—";
                                            const doctorName = (a.doctor?.full_name || a.doctor?.FullName) ?? "—";
                                            const patientName = (a.patient?.full_name || a.patient?.FullName) ?? "—";
                                            const { date, time, full } = fmtStartAt(startAt);
                                            const isPast = isPastAppointment(startAt);
                                            const who = me?.role === "doctor" ? patientName : doctorName;
                                            const whoLabel = me?.role === "doctor" ? "Пациент" : "Дәрігер";
                                            const canCancel = me?.role === "patient" && !isPast && canCancelByPatient(startAt) && status !== "canceled" && status !== "cancelled";
                                            const latestMedId =
                                                latestAppointmentWithMed?.id ?? latestAppointmentWithMed?.Id;
                                            const isLatestMedRow =
                                                me?.role === "patient" &&
                                                latestMedId != null &&
                                                Number(a.id) === Number(latestMedId);
                                            const showCompactMed =
                                                me?.role === "patient" &&
                                                (a.diagnosis || a.clinical_notes) &&
                                                !isLatestMedRow;

                                            return (
                                                <li
                                                    key={a.id}
                                                    className={`profile-appointment ${isPast ? "profile-appointment--past" : ""}`}
                                                    title={full}
                                                >
                                                    <div className="profile-appointment__main">
                                                        <div className="profile-appointment__date-block">
                                                            <span className="profile-appointment__date">{date}</span>
                                                            {time && <span className="profile-appointment__time">{time}</span>}
                                                        </div>
                                                        <div className="profile-appointment__details">
                                                            <p className="profile-appointment__label">{whoLabel}</p>
                                                            <p className="profile-appointment__name">{who}</p>
                                                            {showCompactMed ? (
                                                                <div className="profile-appointment__med">
                                                                    {a.diagnosis ? (
                                                                        <p className="profile-appointment__med-line">
                                                                            <span className="profile-appointment__med-k">
                                                                                Диагноз:
                                                                            </span>{" "}
                                                                            {a.diagnosis}
                                                                        </p>
                                                                    ) : null}
                                                                    {a.clinical_notes ? (
                                                                        <p className="profile-appointment__med-line">
                                                                            <span className="profile-appointment__med-k">
                                                                                Дәрігер жазбасы:
                                                                            </span>{" "}
                                                                            {a.clinical_notes}
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                        <span className={`profile-appointment__status profile-appointment__status--${isPast ? "past" : (status || "").toLowerCase()}`}>
                                                            {appointmentStatusLabel(status, { isPast })}
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
                                    {hasMoreApps && (
                                        <div className="profile-appointments__more">
                                            <button
                                                type="button"
                                                className="btn"
                                                onClick={() => setShowAllApps((v) => !v)}
                                            >
                                                {showAllApps ? "Жасыру" : "Еще"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                                </>
                            )}
                        </section>
                    </div>

                    {referrals.length > 0 && (
                        <section className="profile-card" style={{ marginTop: 20 }}>
                            <h3 className="profile-card__title">Бағыттар (направления)</h3>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                                {referrals.map((ref) => {
                                    const statusColors = { pending: "#f39c12", booked: "#2980b9", completed: "#27ae60", canceled: "#95a5a6" };
                                    const statusLabels = { pending: "Күтуде", booked: "Жазылды", completed: "Аяқталды", canceled: "Бас тартылды" };
                                    return (
                                        <li key={ref.id} style={{ background: "#f8f9fa", borderRadius: 10, padding: "14px 18px", borderLeft: `4px solid ${statusColors[ref.status] || "#ccc"}` }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                                                <div>
                                                    <strong>{ref.to_specialty}</strong>
                                                    {ref.to_doctor?.full_name && <span style={{ color: "#666", marginLeft: 8 }}>— {ref.to_doctor.full_name}</span>}
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: statusColors[ref.status] || "#999" }}>
                                                    {statusLabels[ref.status] || ref.status}
                                                </span>
                                            </div>
                                            {ref.diagnosis && <p style={{ margin: "6px 0 0", fontSize: 14, color: "#444" }}>Диагноз: {ref.diagnosis}</p>}
                                            {ref.notes && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#777" }}>{ref.notes}</p>}
                                            {ref.booked_appointment?.start_at && (
                                                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#2980b9" }}>
                                                    Жазылу: {fmtStartAt(ref.booked_appointment.start_at).full}
                                                </p>
                                            )}
                                            {ref.from_doctor?.full_name && (
                                                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>Терапевт: {ref.from_doctor.full_name}</p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
