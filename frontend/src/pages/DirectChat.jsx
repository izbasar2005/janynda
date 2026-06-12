import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, token } from "../services/api";
import { ensureDirectSubscribed } from "../services/chatRealtime";
import { wsClient } from "../services/ws";

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
    const nearBottomRef = useRef(true);
    const seenMsgIdsRef = useRef(new Set());

    function appendIncomingMessage(prev, m) {
        const next = Array.isArray(prev) ? [...prev] : [];
        const mid = Number(m?.id || 0);
        if (mid) {
            if (seenMsgIdsRef.current.has(mid)) return next;
            seenMsgIdsRef.current.add(mid);
        } else if (next.some((x) => x.body === m.body && x.created_at === m.created_at)) {
            return next;
        }
        next.push(m);
        return next;
    }

    function handleDirectMessagePayload(p) {
        const cid = Number(chatId);
        if (!p || !cid) return;
        setMessages((prev) =>
            appendIncomingMessage(prev, {
                id: p.id,
                sender_id: p.sender_id,
                sender_name: p.sender_name,
                body: p.body,
                created_at: p.created_at,
                is_read_by_peer: false,
                read_at_by_peer: null,
            })
        );
        autoScrollOnceRef.current = nearBottomRef.current || Number(p.sender_id || 0) === me;
        if (Number(p.sender_id || 0) && Number(p.sender_id || 0) !== me) {
            api(`/api/v1/direct-chats/${cid}/read`, {
                method: "POST",
                auth: true,
                body: { last_message_id: Number(p.id || 0) },
            }).catch(() => {});
        }
    }

    function isNearBottom(container, threshold = 100) {
        if (!container) return true;
        return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    }

    const lastOwnMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (Number(m?.sender_id) === me) return Number(m.id || 0);
        }
        return 0;
    }, [messages, me]);

    useEffect(() => {
        // When switching to another direct chat, scroll to bottom again.
        initialScrollDoneRef.current = false;
        autoScrollOnceRef.current = false;
    }, [chatId]);

    useEffect(() => {
        if (!chatId || !token()) return;
        setLoading(true);
        setMessages([]);
        api(`/api/v1/direct-chats/${chatId}/messages`, { auth: true })
            .then((data) => setMessages(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [chatId]);

    useEffect(() => {
        seenMsgIdsRef.current = new Set();
    }, [chatId]);

    useEffect(() => {
        if (!chatId || !token()) return;
        const cid = Number(chatId);
        if (!cid) return;

        ensureDirectSubscribed(cid);
        const off = wsClient.on((evt) => {
            if (!evt) return;

            if (evt.channel === "user" && Number(evt.id) === me && evt.type === "direct:message" && evt.payload) {
                const p = evt.payload;
                const incomingCid = Number(p.conversation_id || p.direct_id || 0);
                if (incomingCid === cid) handleDirectMessagePayload(p);
                return;
            }

            if (evt.channel !== "direct" || Number(evt.id) !== cid) return;
            if (evt.type === "message:new" && evt.payload) {
                handleDirectMessagePayload(evt.payload);
            }
            if (evt.type === "message:read" && evt.payload) {
                const { reader_user_id, last_message_id, read_at } = evt.payload || {};
                // Only peer read matters for receipts; if I read, receipts don't change.
                if (Number(reader_user_id) === me) return;
                const lastID = Number(last_message_id || 0);
                if (!lastID) return;
                setMessages((prev) =>
                    (Array.isArray(prev) ? prev : []).map((m) => {
                        const mid = Number(m.id || 0);
                        if (!mid || mid > lastID) return m;
                        // mark as read by peer
                        return { ...m, is_read_by_peer: true, read_at_by_peer: read_at || m.read_at_by_peer || new Date().toISOString() };
                    })
                );
            }
        });
        return () => {
            off();
            wsClient.unsubscribe("direct", cid);
        };
    }, [chatId, me]);

    useEffect(() => {
        nearBottomRef.current = true;
        const el = messagesScrollRef.current;
        if (!el) return;
        const onScroll = () => {
            nearBottomRef.current = isNearBottom(el);
        };
        el.addEventListener("scroll", onScroll, { passive: true });
        return () => el.removeEventListener("scroll", onScroll);
    }, [chatId]);

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
                    ← Хабарламаларға оралу
                </Link>
                <h2 className="page-header__title">{title}</h2>
            </div>

            <div className="card chat-card">
                <div className="chat-messages" ref={messagesScrollRef}>
                    {messages.length === 0 ? (
                        <p className="muted">Хабарлама жоқ.</p>
                    ) : (
                        messages.map((m) => {
                            const isMine = Number(m.sender_id) === me;
                            const showRead = isMine && Number(m.id) === lastOwnMessageId;
                            return (
                            <div
                                key={m.id}
                                className={`chat-msg ${Number(m.sender_id) === me ? "chat-msg--mine" : ""}`}
                            >
                                <span className="chat-msg__sender">{m.sender_name || "—"}</span>
                                <p className="chat-msg__body">{m.body}</p>
                                <span className="chat-msg__time muted">{fmtTime(m.created_at)}</span>
                                {!m.is_system && showRead && m.is_read_by_peer && m.read_at_by_peer ? (
                                    <span className="chat-msg__read muted">
                                        Көрілді:{" "}
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
