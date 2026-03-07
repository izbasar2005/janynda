import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, token } from "../services/api";

function fmtTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return String(d);
    }
}

export default function Chat() {
    const { appointmentId } = useParams();
    const [conv, setConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!token() || !appointmentId) return;
        api(`/api/v1/conversations/by-appointment/${appointmentId}`, { auth: true })
            .then((data) => {
                setConv(data);
                return api(`/api/v1/conversations/${data.id}/messages`, { auth: true });
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
        const t = setInterval(() => {
            api(`/api/v1/conversations/${conv.id}/messages`, { auth: true })
                .then((data) => setMessages(Array.isArray(data) ? data : []));
        }, 5000);
        return () => clearInterval(t);
    }, [conv?.id]);

    async function send(e) {
        e.preventDefault();
        const text = (body || "").trim();
        if (!text || !conv?.id || sending) return;
        setSending(true);
        try {
            await api(`/api/v1/conversations/${conv.id}/messages`, {
                method: "POST",
                auth: true,
                body: { body: text },
            });
            setBody("");
            const data = await api(`/api/v1/conversations/${conv.id}/messages`, { auth: true });
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            alert(err.message || "Қате");
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Жүктелуде...</p>
            </div>
        );
    }

    if (!conv) {
        return (
            <div className="page">
                <div className="card" style={{ padding: 24 }}>
                    <p className="muted">Чат табылмады немесе әзірге ашылмаған.</p>
                    <Link to="/notifications" className="btn" style={{ marginTop: 12 }}>
                        Ескертулерге оралу
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page chat-page">
            <div className="page-header chat-page__head">
                <Link to="/notifications" className="muted" style={{ marginBottom: 8, display: "inline-block" }}>
                    ← Ескертулер
                </Link>
                <h2 className="page-header__title">Чат (кездесу)</h2>
            </div>

            <div className="card chat-card">
                <div className="chat-messages">
                    {messages.map((m, idx) => {
                        const hasLaterVideoLink = m.video_link && messages.slice(idx + 1).some((msg) => msg.video_link);
                        return (
                        <div
                            key={m.id}
                            className={`chat-msg ${m.is_system ? "chat-msg--system" : ""}`}
                        >
                            {!m.is_system && (
                                <span className="chat-msg__sender">{m.sender_name || "—"}</span>
                            )}
                            {m.video_link ? (
                                <div className="chat-msg__video">
                                    <p className="muted">{m.body}</p>
                                    <a
                                        href={m.video_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`btn chat-video-link ${hasLaterVideoLink ? "chat-video-link--old" : ""}`}
                                    >
                                        Видеоконсультацияға кіру
                                    </a>
                                </div>
                            ) : (
                                <p className="chat-msg__body">{m.body}</p>
                            )}
                            <span className="chat-msg__time muted">{fmtTime(m.created_at)}</span>
                        </div>
                    ); })}
                </div>

                <form className="chat-form" onSubmit={send}>
                    <input
                        type="text"
                        className="input chat-input"
                        placeholder="Хабарлама жазыңыз..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        maxLength={2000}
                    />
                    <button type="submit" className="btn" disabled={sending || !body.trim()}>
                        Жіберу
                    </button>
                </form>
            </div>
        </div>
    );
}
