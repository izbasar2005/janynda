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

    // Email verification state
    const [emailInput, setEmailInput] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [emailSent, setEmailSent] = useState(false);
    const [emailVerifying, setEmailVerifying] = useState(false);
    const [emailMsg, setEmailMsg] = useState("");
    const [emailCountdown, setEmailCountdown] = useState(0);

    function startEmailCountdown() {
        setEmailCountdown(60);
        const timer = setInterval(() => {
            setEmailCountdown((prev) => {
                if (prev <= 1) { clearInterval(timer); return 0; }
                return prev - 1;
            });
        }, 1000);
    }

    async function sendEmailCode() {
        if (!emailInput.trim() || !emailInput.includes("@")) {
            setEmailMsg("Email дұрыс енгізіңіз");
            return;
        }
        setEmailVerifying(true);
        setEmailMsg("");
        try {
            await api("/api/v1/email/send-code", {
                method: "POST", auth: true,
                body: { email: emailInput.trim() },
            });
            setEmailSent(true);
            setEmailMsg("Код email-ге жіберілді ✓");
            startEmailCountdown();
        } catch (e) {
            const errText = e.message;
            try { setEmailMsg(JSON.parse(errText).error || errText); } catch { setEmailMsg(errText); }
        } finally {
            setEmailVerifying(false);
        }
    }

    async function verifyEmailCode() {
        if (!emailCode.trim()) { setEmailMsg("Кодты енгізіңіз"); return; }
        setEmailVerifying(true);
        setEmailMsg("");
        try {
            await api("/api/v1/email/verify-code", {
                method: "POST", auth: true,
                body: { email: emailInput.trim(), code: emailCode.trim() },
            });
            setEmailMsg("Email расталды ✓");
            setEmailSent(false);
            setEmailCode("");
            setMe((prev) => prev ? { ...prev, email: emailInput.trim() } : prev);
            showTopAlert("success", "Email расталды және сақталды");
        } catch (e) {
            const errText = e.message;
            try { setEmailMsg(JSON.parse(errText).error || errText); } catch { setEmailMsg(errText); }
        } finally {
            setEmailVerifying(false);
        }
    }

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
        infoRows.push({ label: "Рөлі", value: me.role === "doctor" ? "Дәрігер" : me.role === "psychologist" ? "Психолог" : me.role === "head_psychologist" ? "Бас психолог" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : me.role === "volunteer" ? "Волонтёр" : "Пациент" });
        if (me.phone) infoRows.push({ label: "Телефон", value: me.phone });
        if (me.email) infoRows.push({ label: "Email", value: me.email });
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
                    {/* Hero card */}
                    <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: 20, padding: "32px 28px", color: "#fff", position: "relative", overflow: "hidden", marginBottom: 24 }}>
                        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
                        <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 20, position: "relative", zIndex: 1 }}>
                            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.2)", border: "3px solid rgba(255,255,255,.4)", overflow: "hidden", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 700, flexShrink: 0, backdropFilter: "blur(4px)" }}>
                                {me?.avatar_url ? (
                                    <img src={me.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                    getInitials(displayName)
                                )}
                            </div>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>{displayName}</h1>
                                <span style={{ display: "inline-block", marginTop: 6, fontSize: 12, fontWeight: 600, background: "rgba(255,255,255,.2)", padding: "3px 12px", borderRadius: 20, backdropFilter: "blur(4px)" }}>
                                    {me.role === "doctor" ? "Дәрігер" : me.role === "psychologist" ? "Психолог" : me.role === "head_psychologist" ? "Бас психолог" : me.role === "admin" ? "Админ" : me.role === "super_admin" ? "Сүпер админ" : me.role === "volunteer" ? "Волонтёр" : "Пациент"}
                                </span>
                                {me.email && (
                                    <p style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.85 }}>{me.email}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="profile-layout">
                        {/* Жеке деректер карточкасы */}
                        <section className="profile-card profile-card--info">
                            <h3 className="profile-card__title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>📋</span> Менің деректерім
                            </h3>
                            <dl className="profile-info" style={{ margin: 0 }}>
                                {infoRows.length > 0 ? (
                                    infoRows.map((row) => (
                                        <div key={row.label} className="profile-info__row" style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                                            <dt className="profile-info__label" style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.label}</dt>
                                            <dd className="profile-info__value" style={{ fontWeight: 500 }}>{row.value}</dd>
                                        </div>
                                    ))
                                ) : (
                                    <div className="profile-info__row">
                                        <dt className="profile-info__label">Аты-жөні</dt>
                                        <dd className="profile-info__value">{displayName}</dd>
                                    </div>
                                )}
                            </dl>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
                                <button type="button" onClick={() => { setEditOpen(true); setPwdOpen(false); }} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 600, borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", transition: "all .15s" }}>
                                    Деректерді өзгерту
                                </button>
                                <button type="button" onClick={() => { setPwdOpen(true); setEditOpen(false); }} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 10, background: "#fff", color: "var(--text)", border: "1px solid var(--border)", cursor: "pointer", transition: "all .15s" }}>
                                    Құпия сөз
                                </button>
                            </div>

                            {/* MODAL: Edit profile */}
                            {editOpen && (
                                <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setEditOpen(false)}>
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }} />
                                    <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 20, padding: "28px 24px", boxShadow: "0 25px 60px rgba(15,23,42,.18)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Деректерді өзгерту</h3>
                                            <button type="button" onClick={() => setEditOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>✕</button>
                                        </div>

                                        {/* Avatar */}
                                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, padding: "14px 16px", background: "#f8fafc", borderRadius: 14 }}>
                                            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)", border: "2px solid #e2e8f0", overflow: "hidden", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700, color: "#4f46e5", flexShrink: 0 }}>
                                                {editForm.avatar_url ? <img src={editForm.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(displayName)}
                                            </div>
                                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                                <label style={{ padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, background: "#fff", border: "1px solid var(--border)", cursor: "pointer" }}>
                                                    Жүктеу
                                                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => uploadAvatar(e.target.files?.[0])} disabled={avatarUploading || editSaving} style={{ display: "none" }} />
                                                </label>
                                                {editForm.avatar_url && <button type="button" onClick={() => setEditForm((p) => ({ ...p, avatar_url: "" }))} style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8, background: "transparent", border: "1px solid #fca5a5", color: "#dc2626", cursor: "pointer" }}>Өшіру</button>}
                                                {avatarUploading && <span style={{ fontSize: 12, color: "var(--muted)" }}>Жүктелуде...</span>}
                                            </div>
                                        </div>

                                        {/* Fields */}
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 12px" }}>
                                            <div style={{ gridColumn: "1 / -1" }}>
                                                <label className="form-label">Аты-жөні</label>
                                                <input className="input" value={editForm.full_name} onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))} placeholder="Асанов Асқар Маратұлы" />
                                            </div>
                                            <div><label className="form-label">Аты</label><input className="input" value={editForm.first_name} onChange={(e) => setEditForm((p) => ({ ...p, first_name: e.target.value }))} placeholder="Асқар" /></div>
                                            <div><label className="form-label">Тегі</label><input className="input" value={editForm.last_name} onChange={(e) => setEditForm((p) => ({ ...p, last_name: e.target.value }))} placeholder="Асанов" /></div>
                                            <div><label className="form-label">Әкесінің аты</label><input className="input" value={editForm.patronymic} onChange={(e) => setEditForm((p) => ({ ...p, patronymic: e.target.value }))} placeholder="Маратұлы" /></div>
                                            <div><label className="form-label">Жынысы</label><select className="input" value={editForm.gender} onChange={(e) => setEditForm((p) => ({ ...p, gender: e.target.value }))}><option value="">—</option><option value="male">Ер адам</option><option value="female">Әйел адам</option></select></div>
                                            <div><label className="form-label">Телефон</label><input className="input" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+7 700 000 00 00" /></div>
                                            <div><label className="form-label">ЖСН</label><input className="input" value={editForm.iin} onChange={(e) => setEditForm((p) => ({ ...p, iin: e.target.value }))} inputMode="numeric" placeholder="000000000000" /></div>
                                        </div>

                                        {/* Email */}
                                        <div style={{ marginTop: 20, padding: 16, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                                <span style={{ fontSize: 15 }}>✉</span>
                                                <span style={{ fontSize: 13, fontWeight: 600 }}>Резервтік Email</span>
                                                {me?.email && <span style={{ fontSize: 10, fontWeight: 600, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 20 }}>Расталған</span>}
                                            </div>
                                            {me?.email && !emailSent && <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px" }}>{me.email}</p>}
                                            <div style={{ display: "flex", gap: 8 }}>
                                                <input className="input" type="email" placeholder="example@gmail.com" value={emailInput} onChange={(e) => { setEmailInput(e.target.value); setEmailSent(false); setEmailCode(""); setEmailMsg(""); }} style={{ flex: 1 }} />
                                                <button type="button" onClick={sendEmailCode} disabled={emailVerifying || emailCountdown > 0 || !emailInput.trim()} style={{ whiteSpace: "nowrap", padding: "8px 14px", fontSize: 12, fontWeight: 500, borderRadius: 8, background: "var(--primary)", color: "#fff", border: "none", cursor: emailVerifying || emailCountdown > 0 ? "not-allowed" : "pointer", opacity: emailVerifying || emailCountdown > 0 ? 0.6 : 1 }}>
                                                    {emailVerifying ? "..." : emailCountdown > 0 ? `${emailCountdown}с` : "Растау"}
                                                </button>
                                            </div>
                                            {emailSent && (
                                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                                    <input className="input" placeholder="4 сан" value={emailCode} onChange={(e) => setEmailCode(e.target.value)} maxLength={4} inputMode="numeric" style={{ maxWidth: 100 }} />
                                                    <button type="button" onClick={verifyEmailCode} disabled={emailVerifying || !emailCode.trim()} style={{ padding: "8px 14px", fontSize: 12, borderRadius: 8, background: "#16a34a", color: "#fff", border: "none", cursor: "pointer", opacity: emailVerifying ? 0.6 : 1 }}>{emailVerifying ? "..." : "Тексеру"}</button>
                                                </div>
                                            )}
                                            {emailMsg && <p style={{ fontSize: 11, marginTop: 6, color: emailMsg.includes("✓") ? "#16a34a" : "#dc2626", fontWeight: 500 }}>{emailMsg}</p>}
                                        </div>

                                        {editMsg && <p style={{ fontSize: 12, marginTop: 12, color: "#dc2626", fontWeight: 500 }}>{editMsg}</p>}

                                        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                                            <button type="button" className="btn" onClick={saveProfile} disabled={editSaving} style={{ flex: 1, padding: "12px 0", fontWeight: 600, borderRadius: 12 }}>
                                                {editSaving ? "Сақталуда..." : "Сақтау"}
                                            </button>
                                            <button type="button" onClick={() => setEditOpen(false)} style={{ flex: 1, padding: "12px 0", fontWeight: 500, borderRadius: 12, background: "#f1f5f9", border: "none", color: "var(--text)", cursor: "pointer" }}>
                                                Болдырмау
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MODAL: Change password */}
                            {pwdOpen && (
                                <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setPwdOpen(false)}>
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }} />
                                    <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 400, background: "#fff", borderRadius: 20, padding: "28px 24px", boxShadow: "0 25px 60px rgba(15,23,42,.18)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                                                <span>🔒</span> Құпия сөзді өзгерту
                                            </h3>
                                            <button type="button" onClick={() => setPwdOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: 16, display: "grid", placeItems: "center" }}>✕</button>
                                        </div>

                                        <div style={{ display: "grid", gap: 14 }}>
                                            <div>
                                                <label className="form-label">Ескі құпия сөз</label>
                                                <div style={{ position: "relative" }}>
                                                    <input className="input" type={pwdShow.old ? "text" : "password"} value={pwdForm.old_password} onChange={(e) => setPwdForm((p) => ({ ...p, old_password: e.target.value }))} placeholder="Ағымдағы құпия сөз" />
                                                    <button type="button" onClick={() => setPwdShow((s) => ({ ...s, old: !s.old }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.6 }}>{pwdShow.old ? "🙈" : "👁"}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="form-label">Жаңа құпия сөз</label>
                                                <div style={{ position: "relative" }}>
                                                    <input className="input" type={pwdShow.next ? "text" : "password"} value={pwdForm.new_password} onChange={(e) => setPwdForm((p) => ({ ...p, new_password: e.target.value }))} placeholder="Кемінде 6 таңба" />
                                                    <button type="button" onClick={() => setPwdShow((s) => ({ ...s, next: !s.next }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.6 }}>{pwdShow.next ? "🙈" : "👁"}</button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="form-label">Қайталау</label>
                                                <div style={{ position: "relative" }}>
                                                    <input className="input" type={pwdShow.confirm ? "text" : "password"} value={pwdForm.confirm} onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))} placeholder="Жаңа құпия сөзді қайталаңыз" />
                                                    <button type="button" onClick={() => setPwdShow((s) => ({ ...s, confirm: !s.confirm }))} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.6 }}>{pwdShow.confirm ? "🙈" : "👁"}</button>
                                                </div>
                                            </div>
                                        </div>

                                        {pwdMsg && <p style={{ fontSize: 12, marginTop: 12, color: "#dc2626", fontWeight: 500 }}>{pwdMsg}</p>}

                                        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                                            <button type="button" className="btn" onClick={changePassword} disabled={pwdSaving} style={{ flex: 1, padding: "12px 0", fontWeight: 600, borderRadius: 12 }}>
                                                {pwdSaving ? "..." : "Өзгерту"}
                                            </button>
                                            <button type="button" onClick={() => setPwdOpen(false)} disabled={pwdSaving} style={{ flex: 1, padding: "12px 0", fontWeight: 500, borderRadius: 12, background: "#f1f5f9", border: "none", color: "var(--text)", cursor: "pointer" }}>
                                                Болдырмау
                                            </button>
                                        </div>
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
                                                    <div className="admin-dashboard-card__label">Қолданушылар</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.users ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Жүйеде тіркелгендер</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Дәрігерлер</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.doctors ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Барлық дәрігерлер</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Жазылулар</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.appointments ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Барлық жазылулар</p>
                                                </div>
                                                <div className="admin-dashboard-card card">
                                                    <div className="admin-dashboard-card__label">Пікірлер</div>
                                                    <div className="admin-dashboard-card__value">{dashboardStats.reviews ?? 0}</div>
                                                    <p className="admin-dashboard-card__hint">Қалдырылған пікірлер</p>
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
