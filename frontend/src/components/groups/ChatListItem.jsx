import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import IconArchive from "./IconArchive";

const SWIPE_THRESHOLD = 56;
const ARCHIVE_ACTION_WIDTH = 86;

function IconChevronDown({ open }) {
    return (
        <svg
            className={`groups-wa-item__menu-chevron${open ? " is-open" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M7 10l5 5 5-5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function ChatListItem({
    avatar,
    name,
    preview,
    time,
    unread = 0,
    isActive = false,
    archiveMode = false,
    onClick,
    onArchive,
    onRestore,
}) {
    const [offsetX, setOffsetX] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const startXRef = useRef(0);
    const startOffsetRef = useRef(0);
    const menuRef = useRef(null);
    const menuBtnRef = useRef(null);

    const actionLabel = archiveMode ? "Қайтару" : "Архивтеу";

    useEffect(() => {
        if (!menuOpen) return;
        function onDocDown(e) {
            if (menuRef.current?.contains(e.target) || menuBtnRef.current?.contains(e.target)) return;
            setMenuOpen(false);
        }
        function onScroll() {
            setMenuOpen(false);
        }
        document.addEventListener("mousedown", onDocDown);
        document.addEventListener("touchstart", onDocDown);
        window.addEventListener("scroll", onScroll, true);
        return () => {
            document.removeEventListener("mousedown", onDocDown);
            document.removeEventListener("touchstart", onDocDown);
            window.removeEventListener("scroll", onScroll, true);
        };
    }, [menuOpen]);

    function resetSwipe() {
        setOffsetX(0);
        setDragging(false);
    }

    function onTouchStart(e) {
        if (menuOpen) setMenuOpen(false);
        startXRef.current = e.touches[0].clientX;
        startOffsetRef.current = offsetX;
        setDragging(true);
    }

    function onTouchMove(e) {
        if (!dragging) return;
        const delta = e.touches[0].clientX - startXRef.current;
        const next = Math.max(
            -ARCHIVE_ACTION_WIDTH,
            Math.min(ARCHIVE_ACTION_WIDTH, startOffsetRef.current + delta)
        );
        setOffsetX(next);
    }

    function onTouchEnd() {
        setDragging(false);
        if (offsetX <= -SWIPE_THRESHOLD) {
            setOffsetX(-ARCHIVE_ACTION_WIDTH);
        } else if (offsetX >= SWIPE_THRESHOLD) {
            setOffsetX(ARCHIVE_ACTION_WIDTH);
        } else {
            resetSwipe();
        }
    }

    function handleArchiveAction(e) {
        e?.stopPropagation?.();
        if (archiveMode) {
            onRestore?.();
        } else {
            onArchive?.();
        }
        setMenuOpen(false);
        resetSwipe();
    }

    function toggleMenu(e) {
        e.stopPropagation();
        const btn = menuBtnRef.current;
        if (!menuOpen && btn) {
            const rect = btn.getBoundingClientRect();
            const menuWidth = 152;
            setMenuPos({
                top: rect.bottom + 4,
                left: Math.max(8, rect.right - menuWidth),
            });
        }
        setMenuOpen((v) => !v);
        resetSwipe();
    }

    const menuPortal =
        menuOpen &&
        createPortal(
            <div
                ref={menuRef}
                className="groups-wa-item__menu groups-wa-item__menu--portal"
                role="menu"
                style={{ top: menuPos.top, left: menuPos.left }}
            >
                <button
                    type="button"
                    className="groups-wa-item__menu-item"
                    role="menuitem"
                    onClick={handleArchiveAction}
                >
                    <IconArchive className="groups-wa-item__menu-item-icon" />
                    {actionLabel}
                </button>
            </div>,
            document.body
        );

    return (
        <>
            <div
                className={`groups-wa-item${dragging ? " is-dragging" : ""}${
                    offsetX !== 0 ? " is-revealed" : ""
                }${menuOpen ? " is-menu-open" : ""}`}
            >
                <button
                    type="button"
                    className={`groups-wa-item__action groups-wa-item__action--left${
                        archiveMode ? " groups-wa-item__action--restore" : ""
                    }`}
                    aria-label={actionLabel}
                    onClick={handleArchiveAction}
                >
                    <IconArchive className="groups-wa-item__action-icon" />
                    <span className="groups-wa-item__action-text">{actionLabel}</span>
                </button>

                <button
                    type="button"
                    className={`groups-wa-item__action groups-wa-item__action--right${
                        archiveMode ? " groups-wa-item__action--restore" : ""
                    }`}
                    aria-label={actionLabel}
                    onClick={handleArchiveAction}
                >
                    <IconArchive className="groups-wa-item__action-icon" />
                    <span className="groups-wa-item__action-text">{actionLabel}</span>
                </button>

                <div
                    className={`groups-wa-item__slide${isActive ? " is-active" : ""}`}
                    style={{ transform: `translateX(${offsetX}px)` }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onTouchCancel={onTouchEnd}
                >
                    <button type="button" className="groups-wa-item__main" onClick={onClick}>
                        <span className="groups-wa-item__avatar">{avatar}</span>
                        <span className="groups-wa-item__body">
                            <span className="groups-wa-item__row groups-wa-item__row--top">
                                <span className="groups-wa-item__name">{name}</span>
                                <span className="groups-wa-item__time groups-wa-item__time--mobile">{time}</span>
                            </span>
                            <span className="groups-wa-item__row groups-wa-item__row--bottom">
                                <span className="groups-wa-item__preview">{preview}</span>
                                {unread > 0 ? (
                                    <span className="groups-wa-item__badge">{unread > 99 ? "99+" : unread}</span>
                                ) : null}
                            </span>
                        </span>
                    </button>

                    <div className="groups-wa-item__aside">
                        <span className="groups-wa-item__time groups-wa-item__time--desktop">{time}</span>
                        <div className="groups-wa-item__menu-wrap">
                            <button
                                ref={menuBtnRef}
                                type="button"
                                className="groups-wa-item__menu-btn"
                                aria-label="Қосымша әрекеттер"
                                aria-expanded={menuOpen ? "true" : "false"}
                                onClick={toggleMenu}
                            >
                                <IconChevronDown open={menuOpen} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {menuPortal}
        </>
    );
}
