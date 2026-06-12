import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, token } from "../services/api";
import { markUnreadNotificationsForAppointment } from "../services/notifications";
import { wsClient } from "../services/ws";
import { NO_AVATAR, normalizePhoto } from "../utils/doctorPhoto";

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

function fmtTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return String(d);
    }
}

function fmtApptTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function resolveDoctorPhoto(doctor, appointment) {
    return normalizePhoto(
        doctor?.avatar_url ||
            doctor?.photo_url ||
            appointment?.doctor?.avatar_url ||
            appointment?.doctor?.photo_url ||
            ""
    );
}

function mergeDoctorFromAppointment(doc, ap) {
    if (doc) return doc;
    if (!ap?.doctor) return null;
    return {
        full_name: ap.doctor.full_name || ap.doctor.name || "",
        specialty: "Дәрігер",
        avatar_url: ap.doctor.avatar_url || "",
        id: ap.doctor_user_id,
        user_id: ap.doctor_user_id,
    };
}

function isImageBody(text) {
    return /(\/uploads\/|\.png|\.jpe?g|\.webp|\.gif)/i.test(text || "");
}

function IconAttach() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8.5 12.5 14.8 6.2a3.5 3.5 0 1 1 5 5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconVideo() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="6.5" width="12" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15.5 10.5l5-2.8v8.6l-5-2.8v-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

function IconChecks() {
    return (
        <svg className="meet-chat__checks" viewBox="0 0 20 14" fill="none" aria-hidden="true">
            <path d="M1.5 7.2 4.8 10.5 9.2 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7.5 7.2 10.8 10.5 15.2 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export default function Chat() {
    const { appointmentId } = useParams();
    const me = Number(parseJwt(token() || "")?.user_id || parseJwt(token() || "")?.id || 0);

    const [conv, setConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [appointment, setAppointment] = useState(null);
    const [doctor, setDoctor] = useState(null);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);

    const messagesScrollRef = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const initialScrollDoneRef = useRef(false);
    const autoScrollOnceRef = useRef(false);

    useEffect(() => {
        if (!token() || !appointmentId) return;
        markUnreadNotificationsForAppointment(appointmentId);
    }, [appointmentId]);

    useEffect(() => {
        if (!token() || !appointmentId) return;
        setLoading(true);
        setMessages([]);
        setAppointment(null);
        setDoctor(null);
        initialScrollDoneRef.current = false;
        autoScrollOnceRef.current = false;

        const aid = Number(appointmentId);

        Promise.all([
            api(`/api/v1/conversations/by-appointment/${appointmentId}`, { auth: true }),
            api("/api/v1/appointments/my", { auth: true }).catch(() => []),
            api("/api/v1/doctors").catch(() => []),
        ])
            .then(([convData, apts, doctors]) => {
                setConv(convData);
                const ap = (Array.isArray(apts) ? apts : []).find((x) => Number(x.id) === aid) || null;
                setAppointment(ap);
                const docUserId = ap?.doctor_user_id || convData?.doctor_user_id;
                const found =
                    (Array.isArray(doctors) ? doctors : []).find(
                        (d) => Number(d.user_id) === Number(docUserId)
                    ) || null;
                setDoctor(mergeDoctorFromAppointment(found, ap));
                return api(`/api/v1/conversations/${convData.id}/messages`, { auth: true });
            })
            .then((data) => setMessages(Array.isArray(data) ? data : []))
            .catch(() => {
                setConv(null);
                setMessages([]);
            })
            .finally(() => setLoading(false));
    }, [appointmentId]);

    useEffect(() => {
        if (!conv?.id) return;
        const cid = Number(conv.id);
        wsClient.subscribe("conversation", cid);
        const off = wsClient.on((evt) => {
            if (!evt || evt.channel !== "conversation" || Number(evt.id) !== cid) return;
            if (evt.type === "message:new" && evt.payload) {
                setMessages((prev) => {
                    const next = Array.isArray(prev) ? [...prev] : [];
                    const m = evt.payload;
                    if (next.some((x) => Number(x.id) === Number(m.id))) return next;
                    next.push({
                        id: m.id,
                        sender_id: m.sender_id,
                        sender_name: m.sender_name,
                        body: m.body,
                        video_link: m.video_link,
                        is_system: m.is_system,
                        created_at: m.created_at,
                    });
                    return next;
                });
            }
        });
        return () => {
            off();
            wsClient.unsubscribe("conversation", cid);
        };
    }, [conv?.id]);

    useEffect(() => {
        if (loading) return;
        const container = messagesScrollRef.current;
        const end = messagesEndRef.current;
        if (!container || !end) return;

        if (!initialScrollDoneRef.current) {
            requestAnimationFrame(() => {
                end.scrollIntoView({ behavior: "auto", block: "end" });
                container.scrollTop = container.scrollHeight;
            });
            initialScrollDoneRef.current = true;
            return;
        }

        if (!autoScrollOnceRef.current) return;
        end.scrollIntoView({ behavior: "smooth", block: "end" });
        autoScrollOnceRef.current = false;
    }, [messages.length, loading, conv?.id]);

    const chatMessages = useMemo(
        () => messages.filter((m) => !(m.is_system && m.video_link)),
        [messages]
    );

    const latestVideoLink = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].video_link) return messages[i].video_link;
        }
        return null;
    }, [messages]);

    const peerName = useMemo(() => {
        if (doctor?.full_name) return `Др. ${doctor.full_name}`;
        if (appointment?.doctor?.full_name) return `Др. ${appointment.doctor.full_name}`;
        return "Дәрігер";
    }, [doctor, appointment]);

    async function reloadMessages() {
        if (!conv?.id) return;
        const data = await api(`/api/v1/conversations/${conv.id}/messages`, { auth: true });
        setMessages(Array.isArray(data) ? data : []);
        autoScrollOnceRef.current = true;
    }

    async function sendMessage(text) {
        const trimmed = (text || "").trim();
        if (!trimmed || !conv?.id || sending || uploading) return;
        setSending(true);
        try {
            await api(`/api/v1/conversations/${conv.id}/messages`, {
                method: "POST",
                auth: true,
                body: { body: trimmed },
            });
            setBody("");
            await reloadMessages();
        } catch (err) {
            alert(err.message || "Қате");
        } finally {
            setSending(false);
        }
    }

    async function send(e) {
        e.preventDefault();
        await sendMessage(body);
    }

    async function uploadAttachment(file) {
        if (!file || !conv?.id) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/v1/upload", {
                method: "POST",
                headers: { Authorization: `Bearer ${token()}` },
                body: fd,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(text || "Жүктеу сәтсіз");
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                /* ignore */
            }
            const url = data.url || "";
            if (!url) throw new Error("Файл сілтемесі алынбады");
            const isImage = file.type.startsWith("image/");
            await sendMessage(isImage ? url : `📎 ${file.name}: ${url}`);
        } catch (err) {
            alert(err.message || "Файл жүктелмеді");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const doctorPhoto = resolveDoctorPhoto(doctor, appointment);

    if (loading) {
        return (
            <div className="meet-chat">
                <div className="meet-chat__skeleton" aria-hidden="true">
                    <div className="meet-chat__sk-head" />
                    <div className="meet-chat__sk-card" />
                    <div className="meet-chat__sk-card meet-chat__sk-card--sm" />
                </div>
            </div>
        );
    }

    if (!conv) {
        return (
            <div className="meet-chat">
                <div className="meet-chat__empty">
                    <p>Чат табылмады немесе әзірге ашылмаған.</p>
                    <Link to="/notifications" className="meet-chat__empty-btn">
                        Ескертулерге оралу
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="meet-chat">
            <header className="meet-chat__header">
                <Link to="/notifications" className="meet-chat__back">
                    ← Ескертулер
                </Link>
                <h1 className="meet-chat__title">Чат (кездесу)</h1>
            </header>

            <div className="meet-chat__profile card-glass">
                <div className="meet-chat__avatar-wrap">
                    <img
                        src={doctorPhoto}
                        alt=""
                        className="meet-chat__avatar"
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = NO_AVATAR;
                        }}
                    />
                </div>
                <div className="meet-chat__profile-info">
                    <div className="meet-chat__profile-name">{peerName}</div>
                    <div className="meet-chat__profile-spec">{doctor?.specialty || "Дәрігер"}</div>
                    <span className="meet-chat__profile-badge">
                        №{String(doctor?.id || appointmentId).padStart(8, "0")}
                    </span>
                </div>
            </div>

            {latestVideoLink ? (
                <div className="meet-chat__video card-glass">
                    <div className="meet-chat__video-icon">
                        <IconVideo />
                    </div>
                    <div className="meet-chat__video-text">
                        <strong>Видеоконсультация</strong>
                        <span>
                            Басталу уақыты: {fmtApptTime(appointment?.start_at) || "—"}
                        </span>
                    </div>
                    <a
                        href={latestVideoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="meet-chat__video-btn"
                    >
                        Видеоконсультацияға кіру
                    </a>
                </div>
            ) : null}

            <div className="meet-chat__panel card-glass">
                <div className="meet-chat__messages" ref={messagesScrollRef}>
                    {chatMessages.length > 0 ? (
                        <div className="meet-chat__day">
                            <span>Бүгін</span>
                        </div>
                    ) : null}

                    {chatMessages.map((m) => {
                        const mine = Number(m.sender_id) === me;
                        return (
                            <div
                                key={m.id}
                                className={`meet-chat__bubble-wrap${mine ? " is-mine" : " is-theirs"}`}
                            >
                                <div className={`meet-chat__bubble${mine ? " is-mine" : " is-theirs"}`}>
                                    {isImageBody(m.body) ? (
                                        <a href={m.body.replace(/^📷\s*/, "")} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={normalizePhoto(m.body.replace(/^📷\s*/, ""))}
                                                alt=""
                                                className="meet-chat__bubble-img"
                                            />
                                        </a>
                                    ) : (
                                        <p>{m.body}</p>
                                    )}
                                    <div className="meet-chat__bubble-meta">
                                        <time>{fmtTime(m.created_at)}</time>
                                        {mine ? <IconChecks /> : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} className="meet-chat__end-anchor" />
                </div>

                <form className="meet-chat__composer" onSubmit={send}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                        className="meet-chat__file-input"
                        onChange={(e) => uploadAttachment(e.target.files?.[0])}
                    />
                    <button
                        type="button"
                        className="meet-chat__attach"
                        aria-label="Файл тіркеу"
                        disabled={uploading || sending}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <IconAttach />
                    </button>
                    <input
                        type="text"
                        className="meet-chat__input"
                        placeholder="Хабарлама жазыңыз..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        maxLength={2000}
                        disabled={uploading}
                    />
                    <button
                        type="submit"
                        className="meet-chat__send"
                        disabled={sending || uploading || !body.trim()}
                    >
                        {uploading ? "..." : "Жіберу"}
                    </button>
                </form>
            </div>
        </div>
    );
}
