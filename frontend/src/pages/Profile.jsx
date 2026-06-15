import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { api, token } from "../services/api";
import { markUnreadAppointmentDoneNotifications } from "../services/notifications";
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
        const d = new Date(s);
        const year = d.getFullYear();
        const month = d.toLocaleDateString("kk-KZ", { month: "long" });
        const day = d.getDate();
        return `${year} ж. ${day} ${month}`;
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

const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='#e2e8f0'/>
    <circle cx='128' cy='102' r='46' fill='#cbd5e1'/>
    <rect x='52' y='160' width='152' height='64' rx='32' fill='#cbd5e1'/>
  </svg>`);

function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http") || url.startsWith("//")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

function fmtApptDisplay(s) {
    if (!s) return "—";
    try {
        const d = new Date(s);
        const year = d.getFullYear();
        const month = d.toLocaleDateString("kk-KZ", { month: "long" });
        const day = d.getDate();
        const time = d.toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
        return `${year} ж. ${day} ${month} ${time}`;
    } catch {
        return String(s);
    }
}

function roleLabelKk(role) {
    if (role === "doctor") return "Дәрігер";
    if (role === "psychologist") return "Психолог";
    if (role === "head_psychologist") return "Бас психолог";
    if (role === "admin") return "Админ";
    if (role === "super_admin") return "Сүпер админ";
    if (role === "volunteer") return "Волонтёр";
    return "Пациент";
}

function getMobileStatusLabel(status, isPast) {
    const v = (status || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "Бас тартылды";
    if (v === "approved" && !isPast) return "Расталған";
    return appointmentStatusLabel(status, { isPast });
}

const PROFILE_AVATAR_FALLBACK = "";

function getMobileStatusClass(status, isPast) {
    const v = (status || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "prof-m__appt-status--canceled";
    if (v === "approved" && !isPast) return "prof-m__appt-status--confirmed";
    if (v === "pending") return "prof-m__appt-status--pending";
    return "prof-m__appt-status--canceled";
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
        if (!token()) return;
        markUnreadAppointmentDoneNotifications();
    }, []);

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

    const nextApptId = useMemo(() => {
        const now = Date.now();
        const future = sortedApps
            .filter((a) => {
                const st = (a.status ?? a.Status ?? "").toLowerCase();
                if (st === "canceled" || st === "cancelled") return false;
                const raw = a.start_at ?? a.startAt ?? a.StartAt;
                const t = new Date(raw).getTime();
                return !Number.isNaN(t) && t > now;
            })
            .sort((a, b) => {
                const ta = new Date(a.start_at ?? a.startAt ?? a.StartAt).getTime();
                const tb = new Date(b.start_at ?? b.startAt ?? b.StartAt).getTime();
                return ta - tb;
            });
        return future[0]?.id ?? future[0]?.Id ?? null;
    }, [sortedApps]);

    const heroInitials = getInitials(displayName);

    const profileAvatarUrl = useMemo(() => {
        const url = (me?.avatar_url || editForm.avatar_url || "").trim();
        return url ? normalizePhoto(url) : PROFILE_AVATAR_FALLBACK;
    }, [me?.avatar_url, editForm.avatar_url]);

    return (
        <div className="page profile-page-v2">
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
            <div className="prof-m">
                <div className="prof-m__hero-wrap">
                    <header className="prof-m__hero">
                        <span className="prof-m__hero-watermark" aria-hidden="true">{heroInitials}</span>
                        <h1 className="prof-m__hero-title">
                            {me ? `${heroInitials} | ${displayName}` : "—"}
                        </h1>
                    </header>
                </div>

                <div className="prof-m__body">
                    {msg && <p className="form-error" style={{ margin: "12px 16px 0" }}>{msg}</p>}

                    {!me ? (
                        <p className="prof-m__loading">Жүктелуде...</p>
                    ) : (
                        <>
                            <section className="prof-m__card">
                                <div className="prof-m__card-layout">
                                    <div className="prof-m__card-avatar-wrap">
                                        {profileAvatarUrl ? (
                                            <img
                                                className="prof-m__card-avatar"
                                                src={profileAvatarUrl}
                                                alt=""
                                            />
                                        ) : (
                                            <div
                                                className="prof-m__card-avatar prof-m__card-avatar--initials"
                                                aria-hidden="true"
                                            >
                                                {heroInitials}
                                            </div>
                                        )}
                                    </div>
                                    <div className="prof-m__card-content">
                                        <h2 className="prof-m__card-title">
                                            <span className="prof-m__card-title-icon" aria-hidden="true">📝</span>
                                            Менің деректерім
                                        </h2>
                                        <div className="prof-m__grid">
                                            <div>
                                                <p className="prof-m__field-label">Аты-жөні</p>
                                                <p className="prof-m__field-value">{displayName}</p>
                                            </div>
                                            <div>
                                                <p className="prof-m__field-label">Рөлі</p>
                                                <p className="prof-m__field-value">{roleLabelKk(me.role)}</p>
                                            </div>
                                            <div>
                                                <p className="prof-m__field-label">Телефон</p>
                                                <p className="prof-m__field-value">{me.phone || "—"}</p>
                                            </div>
                                            <div>
                                                <p className="prof-m__field-label">Тіркелген</p>
                                                <p className="prof-m__field-value">{me.created_at ? fmtDate(me.created_at) : "—"}</p>
                                            </div>
                                        </div>
                                        <div className="prof-m__actions">
                                            <button type="button" className="prof-m__btn prof-m__btn--primary" onClick={() => { setEditOpen(true); setPwdOpen(false); }}>
                                                Деректерді өзгерту
                                            </button>
                                            <button type="button" className="prof-m__btn prof-m__btn--outline" onClick={() => { setPwdOpen(true); setEditOpen(false); }}>
                                                Құпия сөз
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

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

                            {isSuperAdmin ? (
                                <section className="prof-m__section">
                                    <h2 className="prof-m__section-title">
                                        <span className="prof-m__section-icon" aria-hidden="true">📊</span>
                                        Жалпы статистика
                                    </h2>
                                    {dashboardStats ? (
                                        <div className="prof-m__grid">
                                            <div className="prof-m__appt">
                                                <p className="prof-m__field-label">Қолданушылар</p>
                                                <p className="prof-m__field-value" style={{ fontSize: 22 }}>{dashboardStats.users ?? 0}</p>
                                            </div>
                                            <div className="prof-m__appt">
                                                <p className="prof-m__field-label">Дәрігерлер</p>
                                                <p className="prof-m__field-value" style={{ fontSize: 22 }}>{dashboardStats.doctors ?? 0}</p>
                                            </div>
                                            <div className="prof-m__appt">
                                                <p className="prof-m__field-label">Жазылулар</p>
                                                <p className="prof-m__field-value" style={{ fontSize: 22 }}>{dashboardStats.appointments ?? 0}</p>
                                            </div>
                                            <div className="prof-m__appt">
                                                <p className="prof-m__field-label">Пікірлер</p>
                                                <p className="prof-m__field-value" style={{ fontSize: 22 }}>{dashboardStats.reviews ?? 0}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="prof-m__loading">Статистика жүктелуде...</p>
                                    )}
                                </section>
                            ) : (
                                <section className="prof-m__section">
                                    <h2 className="prof-m__section-title">
                                        <span className="prof-m__section-icon" aria-hidden="true">📅</span>
                                        Жазылуларым
                                    </h2>

                                    {isAdmin ? (
                                        <div className="prof-m__empty">
                                            <span className="prof-m__empty-icon" aria-hidden="true">👤</span>
                                            <p className="prof-m__empty-title">Админ аккаунт</p>
                                            <p className="prof-m__empty-text">Пациент жазылулары бұл аккаунтта көрсетілмейді.</p>
                                        </div>
                                    ) : apps.length === 0 ? (
                                        <div className="prof-m__empty">
                                            <span className="prof-m__empty-icon" aria-hidden="true">📅</span>
                                            <p className="prof-m__empty-title">Әзірге жазылу жоқ</p>
                                            <p className="prof-m__empty-text">
                                                Дәрігерлер тізімінен маманды таңдап, ыңғайлы уақытты белгілеңіз.
                                            </p>
                                            <Link to="/doctors" className="prof-m__btn prof-m__btn--primary" style={{ display: "inline-block", textDecoration: "none" }}>
                                                Дәрігерлерге өту
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <ul className="prof-m__appt-list">
                                                {visibleApps.map((a) => {
                                                    const startAt = a.start_at ?? a.startAt ?? a.StartAt;
                                                    const status = a.status ?? a.Status ?? "";
                                                    const doctorName = (a.doctor?.full_name || a.doctor?.FullName) ?? "—";
                                                    const patientName = (a.patient?.full_name || a.patient?.FullName) ?? "—";
                                                    const isPast = isPastAppointment(startAt);
                                                    const who = me?.role === "doctor" ? patientName : doctorName;
                                                    const whoLabel = me?.role === "doctor" ? "Пациент" : "Дәрігер";
                                                    const whoPhoto = me?.role === "doctor"
                                                        ? (a.patient?.avatar_url || a.patient?.photo_url)
                                                        : (a.doctor?.avatar_url || a.doctor?.photo_url);
                                                    const isNext = nextApptId != null && Number(a.id) === Number(nextApptId);
                                                    const canCancel = me?.role === "patient" && !isPast && canCancelByPatient(startAt) && status !== "canceled" && status !== "cancelled";

                                                    return (
                                                        <li key={a.id} className="prof-m__appt">
                                                            <div className="prof-m__appt-top">
                                                                <span className="prof-m__appt-time">{fmtApptDisplay(startAt)}</span>
                                                                {isNext ? (
                                                                    <span className="prof-m__appt-badge prof-m__appt-badge--next">Келесі жазылу</span>
                                                                ) : null}
                                                            </div>
                                                            <div className="prof-m__appt-body">
                                                                <div className="prof-m__appt-avatar-wrap">
                                                                    <img
                                                                        className="prof-m__appt-avatar"
                                                                        src={normalizePhoto(whoPhoto)}
                                                                        alt=""
                                                                    />
                                                                </div>
                                                                <div className="prof-m__appt-info">
                                                                    <p className="prof-m__appt-label">{whoLabel}</p>
                                                                    <p className="prof-m__appt-name">{who}</p>
                                                                </div>
                                                                <span className={`prof-m__appt-status ${getMobileStatusClass(status, isPast)}`}>
                                                                    {getMobileStatusLabel(status, isPast)}
                                                                </span>
                                                            </div>
                                                            {(a.diagnosis || a.clinical_notes) ? (
                                                                <div className="prof-m__appt-med">
                                                                    {a.diagnosis ? (
                                                                        <p className="prof-m__appt-med-line">
                                                                            <span className="prof-m__appt-med-k">Диагноз:</span> {a.diagnosis}
                                                                        </p>
                                                                    ) : null}
                                                                    {a.clinical_notes ? (
                                                                        <p className="prof-m__appt-note">
                                                                            <span className="prof-m__appt-note-icon" aria-hidden="true">💬</span>
                                                                            «{a.clinical_notes}»
                                                                        </p>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}
                                                            {canCancel && (
                                                                <button
                                                                    type="button"
                                                                    className="prof-m__appt-cancel"
                                                                    onClick={() => cancelAppointment(a.id)}
                                                                    disabled={cancellingId === a.id}
                                                                >
                                                                    {cancellingId === a.id ? "Күтіңіз..." : "Бас тарту"}
                                                                </button>
                                                            )}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                            {hasMoreApps && (
                                                <button
                                                    type="button"
                                                    className="prof-m__btn prof-m__btn--outline"
                                                    style={{ width: "100%", marginTop: 12 }}
                                                    onClick={() => setShowAllApps((v) => !v)}
                                                >
                                                    {showAllApps ? "Жасыру" : "Тағы көрсету"}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </section>
                            )}

                            {referrals.length > 0 && (
                                <section className="prof-m__section">
                                    <h2 className="prof-m__section-title">
                                        <span className="prof-m__section-icon" aria-hidden="true">📄</span>
                                        Бағыттар
                                    </h2>
                                    <ul className="prof-m__appt-list">
                                        {referrals.map((ref) => {
                                            const statusLabels = { pending: "Күтуде", booked: "Жазылды", completed: "Аяқталды", canceled: "Бас тартылған" };
                                            return (
                                                <li key={ref.id} className="prof-m__appt">
                                                    <p className="prof-m__appt-name">{ref.to_specialty}</p>
                                                    {ref.to_doctor?.full_name && (
                                                        <p className="prof-m__field-value" style={{ marginTop: 4 }}>{ref.to_doctor.full_name}</p>
                                                    )}
                                                    <p className="prof-m__appt-label" style={{ marginTop: 8 }}>
                                                        {statusLabels[ref.status] || ref.status}
                                                    </p>
                                                    {ref.diagnosis && <p className="prof-m__field-value" style={{ marginTop: 4, fontSize: 13 }}>Диагноз: {ref.diagnosis}</p>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
