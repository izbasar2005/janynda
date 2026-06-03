import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../services/api";
import { getNavLinks } from "./navLinks";

function IconMenu() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
            <path d="M9.6 19a2.4 2.4 0 0 0 4.8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
    const [mobileOpen, setMobileOpen] = useState(false);
    const lastScrollY = useRef(0);
    const profileRef = useRef(null);

    const active = useCallback((p) => (loc.pathname === p ? "is-active" : ""), [loc.pathname]);
    const navLinks = getNavLinks({ token: t, role, active });

    const closeMobile = () => setMobileOpen(false);

    useEffect(() => {
        if (!t) {
            setUnreadCount(0);
            return;
        }
        api("/api/v1/notifications", { auth: true })
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setUnreadCount(list.filter((n) => !n.read_at).length);
            })
            .catch(() => setUnreadCount(0));
    }, [t, loc.pathname]);

    useEffect(() => {
        closeMobile();
        setProfileOpen(false);
    }, [loc.pathname]);

    useEffect(() => {
        document.body.classList.toggle("mobile-nav-open", mobileOpen);
        return () => document.body.classList.remove("mobile-nav-open");
    }, [mobileOpen]);

    useEffect(() => {
        if (mobileOpen) setHidden(false);
    }, [mobileOpen]);

    useEffect(() => {
        lastScrollY.current = window.scrollY || 0;
        setScrolled(lastScrollY.current > 120);
        const handleScroll = () => {
            if (mobileOpen) return;
            const currentY = window.scrollY || 0;
            const diff = currentY - lastScrollY.current;
            if (Math.abs(diff) < 8) return;
            if (currentY > 80 && diff > 0) setHidden(true);
            else if (diff < 0) setHidden(false);
            setScrolled(currentY > 120);
            lastScrollY.current = currentY;
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [mobileOpen]);

    useEffect(() => {
        if (!profileOpen) return;
        const onDown = (e) => {
            if (!profileRef.current?.contains(e.target)) setProfileOpen(false);
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

    useEffect(() => {
        if (!mobileOpen) return;
        const onKey = (e) => {
            if (e.key === "Escape") closeMobile();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [mobileOpen]);

    const showNotifBadge = unreadCount > 0 && loc.pathname !== "/notifications";

    const logout = () => {
        localStorage.removeItem("token");
        closeMobile();
        nav("/login");
    };

    const headerClass = [
        "app-header",
        hidden && !mobileOpen ? "app-header--hidden" : "",
        scrolled || mobileOpen ? "app-header--solid" : "app-header--overlay",
    ]
        .filter(Boolean)
        .join(" ");

    const renderNavLinks = (linkClass) =>
        navLinks.map(({ to, label, className }) => (
            <Link
                key={to}
                className={`${linkClass} ${className}`.trim()}
                to={to}
                onClick={closeMobile}
            >
                {label}
            </Link>
        ));

    return (
        <header className={headerClass}>
            <div className="app-header__inner">
                <Link className="app-brand" to="/" onClick={closeMobile}>
                    <img src="/img/logo.png" alt="Janynda логотипі" className="app-brand__logo" />
                    <span className="app-brand__text">Janynda</span>
                </Link>

                <nav className="app-nav app-nav--desktop" aria-label="Негізгі мәзір">
                    {renderNavLinks("app-nav__link")}
                </nav>

                <div className="app-header__right">
                    <button
                        type="button"
                        className="app-header__menu-btn"
                        aria-label={mobileOpen ? "Мәзірді жабу" : "Мәзірді ашу"}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav-panel"
                        onClick={() => setMobileOpen((v) => !v)}
                    >
                        <IconMenu />
                    </button>

                    {t && (
                        <span className="app-header__notif-wrap">
                            <Link
                                to="/notifications"
                                className="app-header__notif"
                                title="Ескертулер"
                                aria-label="Ескертулер"
                            >
                                <IconBell className="app-header__icon" />
                            </Link>
                            {showNotifBadge && <span className="app-header__notif-badge" aria-hidden="true" />}
                        </span>
                    )}

                    {!t ? (
                        <div className="app-authlinks app-authlinks--desktop">
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

            <div
                id="mobile-nav"
                className={`mobile-nav ${mobileOpen ? "is-open" : ""}`}
                aria-hidden={!mobileOpen}
            >
                <button
                    type="button"
                    className="mobile-nav__backdrop"
                    aria-label="Мәзірді жабу"
                    tabIndex={mobileOpen ? 0 : -1}
                    onClick={closeMobile}
                />
                <div id="mobile-nav-panel" className="mobile-nav__panel" role="dialog" aria-modal="true" aria-label="Навигация">
                    <div className="mobile-nav__head">
                        <span className="mobile-nav__title">Мәзір</span>
                        <button type="button" className="mobile-nav__close" aria-label="Жабу" onClick={closeMobile}>
                            ×
                        </button>
                    </div>
                    <nav className="mobile-nav__body" aria-label="Мобильді мәзір">
                        {renderNavLinks("mobile-nav__link")}
                        {!t && (
                            <div className="mobile-nav__section">
                                <div className="mobile-nav__section-title">Аккаунт</div>
                                <div className="mobile-nav__auth">
                                    <Link className="btn ghost" to="/login" onClick={closeMobile}>
                                        Кіру
                                    </Link>
                                    <Link className="btn" to="/register" onClick={closeMobile}>
                                        Тіркелу
                                    </Link>
                                </div>
                            </div>
                        )}
                        {t && (
                            <div className="mobile-nav__section">
                                <div className="mobile-nav__section-title">Аккаунт</div>
                                <Link className="mobile-nav__link" to="/profile" onClick={closeMobile}>
                                    Менің деректерім
                                </Link>
                                <Link className="mobile-nav__link" to="/notifications" onClick={closeMobile}>
                                    Ескертулер
                                    {showNotifBadge && " •"}
                                </Link>
                                <button
                                    type="button"
                                    className="mobile-nav__link"
                                    style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
                                    onClick={logout}
                                >
                                    Шығу
                                </button>
                            </div>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}
