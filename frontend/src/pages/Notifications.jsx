import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import NotificationCard from "../components/notifications/NotificationCard";
import { IconRefresh } from "../components/notifications/NotificationIcons";
import { api, token } from "../services/api";

function NotificationSkeleton() {
    return (
        <div className="notif-skeleton" aria-hidden="true">
            {[1, 2, 3].map((i) => (
                <div key={i} className="notif-skeleton__card">
                    <div className="notif-skeleton__row">
                        <span className="notif-skeleton__pill" />
                        <span className="notif-skeleton__date" />
                    </div>
                    <span className="notif-skeleton__line notif-skeleton__line--lg" />
                    <span className="notif-skeleton__line" />
                    <span className="notif-skeleton__line notif-skeleton__line--sm" />
                </div>
            ))}
        </div>
    );
}

export default function Notifications() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sending, setSending] = useState(null);
    const [pullDistance, setPullDistance] = useState(0);
    const touchStartY = useRef(0);
    const listRef = useRef(null);

    const loadNotifications = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const data = await api("/api/v1/notifications", { auth: true });
            setList(Array.isArray(data) ? data : []);
        } catch {
            setList([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
            setPullDistance(0);
        }
    }, []);

    useEffect(() => {
        if (!token()) {
            nav("/login");
            return;
        }
        loadNotifications();
    }, [nav, loadNotifications]);

    async function markRead(id) {
        setList((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n))
        );
        try {
            await api(`/api/v1/notifications/${id}/read`, { method: "POST", auth: true });
        } catch {
            loadNotifications(true);
        }
    }

    async function setChoice(notifId, choice) {
        setSending(notifId);
        try {
            await api(`/api/v1/notifications/${notifId}/choice`, {
                method: "POST",
                auth: true,
                body: { choice },
            });
            const now = new Date().toISOString();
            setList((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, choice, read_at: now } : n))
            );
            if (choice === "chat" || choice === "video") {
                const appId = list.find((x) => x.id === notifId)?.appointment_id;
                if (appId) nav(`/chat/${appId}`);
            }
        } catch (e) {
            alert(e.message || "Қате");
        } finally {
            setSending(null);
        }
    }

    function onTouchStart(e) {
        if (window.scrollY > 0) return;
        touchStartY.current = e.touches[0].clientY;
    }

    function onTouchMove(e) {
        if (window.scrollY > 0 || refreshing) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta > 0) setPullDistance(Math.min(delta, 96));
    }

    async function onTouchEnd() {
        if (pullDistance > 64) await loadNotifications(true);
        else setPullDistance(0);
    }

    return (
        <div
            className="notif-page"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div
                className={`notif-page__pull${pullDistance > 0 || refreshing ? " is-visible" : ""}`}
                style={{ height: refreshing ? 48 : pullDistance }}
                aria-hidden="true"
            >
                <span className={`notif-page__pull-icon${refreshing ? " is-spinning" : ""}`}>
                    <IconRefresh />
                </span>
            </div>

            <header className="notif-page__header">
                <h1 className="notif-page__title">Хабарламалар</h1>
                <p className="notif-page__subtitle">
                    Жазылу туралы еске салулар, кездесу тәсілін таңдау және дәрігерге жазба ескертулері.
                </p>
            </header>

            {loading ? (
                <NotificationSkeleton />
            ) : list.length === 0 ? (
                <div className="notif-empty">
                    <h2 className="notif-empty__title">Ескертулер әзірге жоқ</h2>
                    <p className="notif-empty__text">
                        Жаңа жазылу немесе кездесу туралы хабарламалар осында пайда болады.
                    </p>
                </div>
            ) : (
                <div className="notif-page__list-wrap" ref={listRef}>
                    <ul className="notif-list">
                        {list.map((n, index) => (
                            <li
                                key={n.id}
                                className="notif-list__item"
                                style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                            >
                                <NotificationCard
                                    notification={n}
                                    sending={sending}
                                    onChoice={setChoice}
                                    onMarkRead={markRead}
                                />
                            </li>
                        ))}
                    </ul>
                    <p className="notif-page__end">
                        <span className={`notif-page__end-icon${refreshing ? " is-spinning" : ""}`} aria-hidden="true">
                            <IconRefresh />
                        </span>
                        All caught up
                    </p>
                </div>
            )}
        </div>
    );
}
