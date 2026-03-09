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
        <header className={`app-header ${hidden ? "app-header--hidden" : ""}`}>
            <div className="app-header__inner">
                {/* Left: logo + brand */}
                <Link className="app-brand" to="/">
                    <img src="/img/logo.png" alt="Janymda" className="app-brand__logo" />
                    <span className="app-brand__text">Janymda</span>
                </Link>

                {/* Center: nav */}
                <nav className="app-nav" aria-label="Main">
                    <Link className={`app-nav__link ${active("/")}`} to="/">
                        Главная
                    </Link>

                    {/* "Запись" — super_admin үшін көрсетілмейді */}
                    {role !== "super_admin" && (
                        <Link className={`app-nav__link ${active("/doctors")}`} to="/doctors">
                            Запись
                        </Link>
                    )}

                    {/* "Мои данные" — бізде /profile */}
                    {t && (
                        <Link className={`app-nav__link ${active("/profile")}`} to="/profile">
                            Мои данные
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
                                Войти
                            </Link>
                            <Link className={`app-authlinks__link ${active("/register")}`} to="/register">
                                Регистрация
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