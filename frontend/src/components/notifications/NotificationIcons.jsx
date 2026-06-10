export function IconSearch() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function IconRefresh() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M20 12a8 8 0 1 1-2.3-5.7M20 4v6h-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconCheckAll() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l3.5 3.5L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 6.5h5M5 17.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function IconUsers() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="17" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5M14.5 19c0-1.8 1.3-3.2 3-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function IconVideo() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="6.5" width="12" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M15.5 10.5l5-2.8v8.6l-5-2.8v-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
    );
}

export function IconChat() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M6 7.5h12a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H10l-4.5 3v-3H6a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path d="M8.5 11h7M8.5 14h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function IconPhone() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M8.5 5.5c.4 2.2 1.4 4.3 2.9 6.1 1.6 1.8 3.5 3.1 5.7 3.8l2.2-2.2c.3-.3.8-.4 1.2-.2 1 .4 2.1.7 3.2.7.6 0 1.1.5 1.1 1.1V19c0 .6-.5 1.1-1.1 1.1C10.9 20.1 4 13.2 4 4.6 4 4 4.5 3.5 5.1 3.5H8c.6 0 1.1.5 1.1 1.1 0 1.1.3 2.2.7 3.2.1.4 0 .9-.3 1.2l-2 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function IconBellSmall() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

export function IconClockSmall() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 8v4.2l2.8 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function IconCheckSmall() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8.5 12.2l2.3 2.3 4.7-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function IconAlertSmall() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 8.5v4.2M12 15.8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function badgeIcon(name) {
    switch (name) {
        case "reminder":
            return <IconClockSmall />;
        case "confirmed":
            return <IconCheckSmall />;
        case "missed":
            return <IconAlertSmall />;
        case "choice":
        default:
            return <IconBellSmall />;
    }
}
