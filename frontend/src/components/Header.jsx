import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";

function IconChat({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7.5 19.5c-1.8 0-3-1.2-3-3v-7.2c0-1.8 1.2-3 3-3h9c1.8 0 3 1.2 3 3v7.2c0 1.8-1.2 3-3 3H12l-3.9 2.3c-.4.2-.6 0-.6-.4V19.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path
                d="M8.2 11.3h7.6M8.2 14.2h5.2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconBell({ className }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 3.5c-3.4 0-6 2.6-6 6v3.2c0 .8-.3 1.6-.9 2.2l-1 1.1c-.3.3-.1.8.3.8h15.2c.4 0 .6-.5.3-.8l-1-1.1c-.6-.6-.9-1.4-.9-2.2V9.5c0-3.4-2.6-6-6-6Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path
                d="M9.6 19a2.4 2.4 0 0 0 4.8 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
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

function initialsFromToken(t) {
    const p = parseJwt(t);
    const name = (p?.name || p?.login || p?.phone || "").toString().trim();
    if (!name) return "U";
    const parts = name.split(/\s+/).filter(Boolean);
    const a = (parts[0]?.[0] || "U").toUpperCase();
    const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
    return (a + b).slice(0, 2);
}

export default function Header() {
    const loc = useLocation();
    const nav = useNavigate();
    const t = localStorage.getItem("token");
    const role = t ? (parseJwt(t)?.role || "user") : "guest";
    const [unreadCount, setUnreadCount] = useState(0);
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const lastScrollY = useRef(0);
    const profileRef = useRef(null);

    useEffect(() => {
        if (!t) {
            setUnreadCount(0);
            return;
        }
        api("/api/v1/notifications", { auth: true })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                const count = list.filter((n) => !n.read_at).length;
                setUnreadCount(count);
            })
            .catch(() => setUnreadCount(0));
    }, [t, loc.pathname]);

    // Hide header on scroll down, show on scroll up
    useEffect(() => {
        lastScrollY.current = window.scrollY || 0;
        setScrolled(lastScrollY.current > 120);
        const handleScroll = () => {
            const currentY = window.scrollY || 0;
            const diff = currentY - lastScrollY.current;

            // кішкентай қозғалысты елемеу
            if (Math.abs(diff) < 8) {
                return;
            }

            if (currentY > 80 && diff > 0) {
                // төмен қарай жылжығанда — жасырамыз
                setHidden(true);
            } else if (diff < 0) {
                // жоғары қайтқанда — қайта көрсетеміз
                setHidden(false);
            }

            // hero-дан айтарлықтай төмен түскенде — хедерді толық ақ қыламыз
            setScrolled(currentY > 120);

            lastScrollY.current = currentY;
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const showNotifBadge = unreadCount > 0 && loc.pathname !== "/notifications";

    const active = (p) => (loc.pathname === p ? "is-active" : "");

    const logout = () => {
        localStorage.removeItem("token");
        nav("/login");
    };

    // Close profile menu on outside click / Esc
    useEffect(() => {
        if (!profileOpen) return;
        const onDown = (e) => {
            if (!profileRef.current) return;
            if (!profileRef.current.contains(e.target)) setProfileOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setProfileOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [profileOpen]);

    return (
        <header className={`app-header ${hidden ? "app-header--hidden" : ""} ${scrolled ? "app-header--solid" : "app-header--overlay"}`}>
            <div className="app-header__inner">
                {/* Left: logo + brand */}
                <Link className="app-brand" to="/">
                    <img src="/img/logo.png" alt="Janynda логотипі" className="app-brand__logo" />
                    <span className="app-brand__text">Janynda</span>
                </Link>

                {/* Center: nav */}
                <nav className="app-nav" aria-label="Main">
                    <Link className={`app-nav__link ${active("/")}`} to="/">
                        Басты бет
                    </Link>

                    {t && (role === "patient" || role === "volunteer") && (
                        <Link className={`app-nav__link ${active("/doctors")}`} to="/doctors">
                            Дәрігерге жазылу
                        </Link>
                    )}

                    {t && (role === "patient" || role === "volunteer") && (
                        <Link className={`app-nav__link ${active("/diary")}`} to="/diary">
                            Күнделік
                        </Link>
                    )}

                    {t && role === "doctor" && (
                        <Link className={`app-nav__link ${active("/doctor")}`} to="/doctor">
                            Дәрігер кабинеті
                        </Link>
                    )}
                    {t && role === "psychologist" && (
                        <Link className={`app-nav__link ${active("/psych")}`} to="/psych">
                            Психолог кабинеті
                        </Link>
                    )}
                    {t && (
                        <Link className={`app-nav__link ${active("/groups")}`} to="/groups">
                            Топтар
                        </Link>
                    )}

                    {/* Admin логикасы сақталсын */}
                    {t && role === "admin" && (
                        <>
                            <Link className={`app-nav__link ${active("/admin/doctors")}`} to="/admin/doctors">
                                Admin Doctors
                            </Link>
                            <Link className={`app-nav__link ${active("/admin/users")}`} to="/admin/users">
                                Users
                            </Link>
                            <Link className={`app-nav__link ${active("/admin/news")}`} to="/admin/news">
                                News
                            </Link>
                        </>
                    )}
                    {t && role === "super_admin" && (
                        <>
                            <Link className={`app-nav__link ${active("/admin/dashboard")}`} to="/admin/dashboard">
                                Dashboard
                            </Link>
                            <Link className={`app-nav__link ${active("/psych")}`} to="/psych">
                                Кейстер
                            </Link>
                            <Link className={`app-nav__link ${active("/admin/doctors-stats")}`} to="/admin/doctors-stats">
                                Дәрігерлер
                            </Link>
                            <Link className={`app-nav__link ${active("/admin/users")}`} to="/admin/users">
                                Users
                            </Link>
                            <Link className={`app-nav__link ${active("/admin/news")}`} to="/admin/news">
                                News
                            </Link>
                        </>
                    )}
                </nav>

                {/* Right: language + auth */}
                <div className="app-header__right">
                    {t && (
                        <span className="app-header__notif-wrap">
                            <Link to="/notifications" className="app-header__notif" title="Ескертулер" aria-label="Ескертулер">
                                <IconBell className="app-header__icon" />
                            </Link>
                            {showNotifBadge && <span className="app-header__notif-badge" aria-hidden="true" />}
                        </span>
                    )}

                    {!t ? (
                        <div className="app-authlinks">
                            <Link className={`app-authlinks__link ${active("/login")}`} to="/login">
                                Кіру
                            </Link>
                            <Link className={`app-authlinks__link ${active("/register")}`} to="/register">
                                Тіркелу
                            </Link>
                        </div>
                    ) : (
                        <div className="app-user" ref={profileRef}>
                            <button
                                type="button"
                                className="app-user__avatar"
                                title="Профиль"
                                aria-label="Профиль"
                                aria-haspopup="menu"
                                aria-expanded={profileOpen ? "true" : "false"}
                                onClick={() => setProfileOpen((v) => !v)}
                            >
                                {initialsFromToken(t)}
                            </button>

                            {profileOpen && (
                                <div className="app-user__menu" role="menu" aria-label="Профиль мәзірі">
                                    <Link
                                        to="/profile"
                                        className="app-user__menuitem"
                                        role="menuitem"
                                        onClick={() => setProfileOpen(false)}
                                    >
                                        Менің деректерім
                                    </Link>
                                    <button
                                        type="button"
                                        className="app-user__menuitem app-user__menuitem--danger"
                                        role="menuitem"
                                        onClick={() => {
                                            setProfileOpen(false);
                                            logout();
                                        }}
                                    >
                                        Шығу
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}