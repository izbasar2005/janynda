import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";
import { getNavLinks } from "./navLinks";
import { useBottomSheetDrag } from "../hooks/useBottomSheetDrag";

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

function IconHome() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19V10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

function IconCalendar() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7 4v2M17 4v2M4.5 9h15M6 6.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function IconDiary() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

function IconGroups() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="17" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14 19c0-2 1.5-3.6 3.5-3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function IconUser() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 19c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function IconSettings() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
                d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconLogout() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-7A1.5 1.5 0 0 1 10 18.5V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M14 12H4m0 0 3-3M4 12l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconDefault() {
    return (
        <svg className="mobile-nav__item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

const NAV_ICONS = {
    "/": IconHome,
    "/doctors": IconCalendar,
    "/diary": IconDiary,
    "/groups": IconGroups,
    "/profile": IconUser,
};

function navIconFor(path) {
    if (path === "/notifications") return <IconSettings />;
    const Icon = NAV_ICONS[path] || IconDefault;
    return <Icon />;
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
    const role = t ? String(parseJwt(t)?.role || "patient").toLowerCase() : "guest";
    const [unreadCount, setUnreadCount] = useState(0);
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const lastScrollY = useRef(0);
    const profileRef = useRef(null);

    const isActive = useCallback(
        (p) => {
            if (p === "/") return loc.pathname === "/";
            return loc.pathname === p || loc.pathname.startsWith(p + "/");
        },
        [loc.pathname]
    );

    const navLinks = getNavLinks({ token: t, role, active: isActive });

    const closeMobile = useCallback(() => setMobileOpen(false), []);

    const {
        panelRef,
        bodyRef,
        dragging,
        sheetProps,
        closeSheet,
        shouldBlockClick,
        backdropOpacity,
    } = useBottomSheetDrag({ open: mobileOpen, onClose: closeMobile });

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

    const goMobile = (to) => {
        if (shouldBlockClick()) return;
        closeMobile();
        nav(to);
    };

    const renderMobileNavItem = (to, label, className = "") => (
        <button
            key={to}
            type="button"
            className={`mobile-nav__item ${isActive(to) ? "is-active" : ""} ${className}`.trim()}
            onClick={() => goMobile(to)}
        >
            {navIconFor(to)}
            <span>{label}</span>
        </button>
    );

    const mobileNavSheet = (
        <div
            id="mobile-nav"
            className={`mobile-nav ${mobileOpen ? "is-open" : ""}`}
            aria-hidden={!mobileOpen}
        >
            <button
                type="button"
                className="mobile-nav__backdrop"
                aria-label="Жабу"
                tabIndex={mobileOpen ? 0 : -1}
                onClick={closeSheet}
                style={{ opacity: mobileOpen ? backdropOpacity : 0 }}
            />
            <div
                id="mobile-nav-panel"
                ref={panelRef}
                className={`mobile-nav__panel${dragging ? " is-sheet-dragging" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Навигация"
                {...sheetProps}
            >
                <div className="mobile-nav__drag-zone" data-sheet-handle>
                    <span className="mobile-nav__grabber" aria-hidden="true" />
                </div>
                <nav ref={bodyRef} className="mobile-nav__body" aria-label="Негізгі навигация">
                    {navLinks.map(({ to, label }) => renderMobileNavItem(to, label))}

                    <hr className="mobile-nav__divider" />

                    <div className="mobile-nav__section-title">АККАУНТ</div>

                    {!t ? (
                        <div className="mobile-nav__auth">
                            <Link className="btn ghost" to="/login" onClick={closeMobile}>
                                Кіру
                            </Link>
                            <Link className="btn" to="/register" onClick={closeMobile}>
                                Тіркелу
                            </Link>
                        </div>
                    ) : (
                        <>
                            {renderMobileNavItem("/profile", "Менің деректерім")}
                            {renderMobileNavItem("/notifications", "Ескертулер")}
                            <button
                                type="button"
                                className="mobile-nav__item mobile-nav__item--danger"
                                onClick={() => {
                                    if (!shouldBlockClick()) logout();
                                }}
                            >
                                <IconLogout />
                                <span>Шығу</span>
                            </button>
                        </>
                    )}
                </nav>
            </div>
        </div>
    );

    return (
        <>
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
                        className="app-header__menu-btn app-header__glass-btn"
                        aria-label={mobileOpen ? "Жабу" : "Навигация"}
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav-panel"
                        onClick={() => (mobileOpen ? closeSheet() : setMobileOpen(true))}
                    >
                        <IconMenu />
                    </button>

                    <span className="app-header__notif-wrap">
                        <Link
                            to={t ? "/notifications" : "/login"}
                            className="app-header__notif app-header__glass-btn"
                            aria-label="Ескертулер"
                        >
                            <IconBell className="app-header__icon" />
                        </Link>
                        {showNotifBadge && <span className="app-header__notif-badge" aria-hidden="true" />}
                    </span>

                    {!t ? (
                        <div className="app-authlinks app-authlinks--desktop">
                            <Link className={`app-authlinks__link ${isActive("/login")}`} to="/login">
                                Кіру
                            </Link>
                            <Link className={`app-authlinks__link ${isActive("/register")}`} to="/register">
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
        {createPortal(mobileNavSheet, document.body)}
        </>
    );
}
