import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, token } from "../services/api";

function fmtTime(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleTimeString("kk-KZ", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function parseJwt(t) {
    try {
        const base = t.split(".")[1];
        const json = atob(base.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decodeURIComponent(escape(json)));
    } catch {
        return null;
    }
}

export default function DirectChat() {
    const { chatId } = useParams();
    const [search] = useSearchParams();
    const peerName = search.get("peer") || "Қатысушы";
    const me = Number(parseJwt(token() || "")?.user_id || parseJwt(token() || "")?.id || 0);

    const [messages, setMessages] = useState([]);
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const messagesScrollRef = useRef(null);
    const messagesEndRef = useRef(null);
    const initialScrollDoneRef = useRef(false);
    const autoScrollOnceRef = useRef(false);

    useEffect(() => {
        // When switching to another direct chat, scroll to bottom again.
        initialScrollDoneRef.current = false;
        autoScrollOnceRef.current = false;
    }, [chatId]);

    useEffect(() => {
        if (!chatId || !token()) return;
        api(`/api/v1/direct-chats/${chatId}/messages`, { auth: true })
            .then((data) => setMessages(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [chatId]);

    useEffect(() => {
        if (!chatId || !token()) return;
        const t = setInterval(() => {
            api(`/api/v1/direct-chats/${chatId}/messages`, { auth: true })
                .then((data) => setMessages(Array.isArray(data) ? data : []))
                .catch(() => {});
        }, 4000);
        return () => clearInterval(t);
    }, [chatId]);

    useEffect(() => {
        if (loading) return;
        const container = messagesScrollRef.current;
        const end = messagesEndRef.current;
        if (!container || !end) return;

        if (!initialScrollDoneRef.current) {
            end.scrollIntoView({ behavior: "auto", block: "end" });
            initialScrollDoneRef.current = true;
            return;
        }

        if (!autoScrollOnceRef.current) return;
        end.scrollIntoView({ behavior: "smooth", block: "end" });
        autoScrollOnceRef.current = false;
    }, [messages.length, loading]);

    const title = useMemo(() => `Жеке чат: ${peerName}`, [peerName]);

    async function send(e) {
        e.preventDefault();
        const text = (body || "").trim();
        if (!chatId || !text || sending) return;
        setSending(true);
        try {
            await api(`/api/v1/direct-chats/${chatId}/messages`, {
                method: "POST",
                auth: true,
                body: { body: text },
            });
            setBody("");
            autoScrollOnceRef.current = true;
            const data = await api(`/api/v1/direct-chats/${chatId}/messages`, { auth: true });
            setMessages(Array.isArray(data) ? data : []);
        } catch (err) {
            alert(err.message || "Қате");
        } finally {
            setSending(false);
        }
    }

    if (loading) {
        return <div className="page"><p className="muted">Жүктелуде...</p></div>;
    }

    return (
        <div className="page chat-page">
            <div className="page-header chat-page__head">
                <Link to="/groups" className="muted" style={{ marginBottom: 8, display: "inline-block" }}>
                    ← Топтарға оралу
                </Link>
                <h2 className="page-header__title">{title}</h2>
            </div>

            <div className="card chat-card">
                <div className="chat-messages" ref={messagesScrollRef}>
                    {messages.length === 0 ? (
                        <p className="muted">Хабарлама жоқ.</p>
                    ) : (
                        messages.map((m, idx) => {
                            const isLast = idx === messages.length - 1;
                            const isMine = Number(m.sender_id) === me;
                            return (
                            <div
                                key={m.id}
                                className={`chat-msg ${Number(m.sender_id) === me ? "chat-msg--mine" : ""}`}
                            >
                                <span className="chat-msg__sender">{m.sender_name || "—"}</span>
                                <p className="chat-msg__body">{m.body}</p>
                                <span className="chat-msg__time muted">{fmtTime(m.created_at)}</span>
                                {!m.is_system && isLast && isMine && m.is_read_by_peer && m.read_at_by_peer ? (
                                    <span className="chat-msg__read muted">
                                        Просмотрено:{" "}
                                        {new Date(m.read_at_by_peer).toLocaleString("kk-KZ", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                ) : null}
                            </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} style={{ height: 1 }} />
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
