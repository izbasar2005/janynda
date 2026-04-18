import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { api } from "../services/api";

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
    const lastScrollY = useRef(0);

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

                    {/* "Запись" — super_admin үшін көрсетілмейді */}
                    {role !== "super_admin" && (
                        <Link className={`app-nav__link ${active("/doctors")}`} to="/doctors">
                            Дәрігерге жазылу
                        </Link>
                    )}

                    {/* Профиль беті */}
                    {t && (
                        <Link className={`app-nav__link ${active("/profile")}`} to="/profile">
                            Менің деректерім
                        </Link>
                    )}
                    {t && role === "doctor" && (
                        <Link className={`app-nav__link ${active("/doctor")}`} to="/doctor">
                            Дәрігер кабинеті
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
                    {/* Diary icon link */}
                    {t && (
                        <Link to="/diary" className="app-header__diary-link" title="Күнделікке өту" aria-label="Күнделікке өту">
                            <span className="app-header__diary-emoji" aria-hidden="true">📓</span>
                        </Link>
                    )}

                    {t && (
                        <span className="app-header__notif-wrap">
                            <Link to="/notifications" className="app-header__notif" title="Ескертулер" aria-label="Ескертулер">
                                {initialsFromToken(t)}
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
                        <div className="app-user">
                            <a
                                className="app-user__logout"
                                href="#"
                                onClick={(e) => (e.preventDefault(), logout())}
                            >
                                Выйти
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}