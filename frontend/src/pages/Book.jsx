import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='#e2e8f0'/>
    <circle cx='128' cy='102' r='46' fill='#cbd5e1'/>
    <rect x='52' y='160' width='152' height='64' rx='32' fill='#cbd5e1'/>
  </svg>`);

function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http") || url.startsWith("//")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

function getInitials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    const a = (parts[0]?.[0] || "U").toUpperCase();
    const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
    return (a + b).slice(0, 2);
}

function buildDateOptions(count = 21) {
    const dates = [];
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push({
            value: d.toISOString().slice(0, 10),
            weekday: d.toLocaleDateString("kk-KZ", { weekday: "short" }),
            day: d.getDate(),
            month: d.toLocaleDateString("kk-KZ", { month: "short" }),
            full: d.toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" }),
        });
    }
    return dates;
}

function IconMenu() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

function IconBell() {
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

function IconCheck() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconCalendar() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M7 4v2M17 4v2M4.5 9h15M6 6.5h12a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function scrollCarousel(el, direction) {
    if (!el) return;
    const chip = el.querySelector(".book-m__date-chip, .book-m__time-chip");
    const step = chip ? chip.offsetWidth + 10 : 88;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
}

function CarouselWithArrows({ label, labelClass = "", ariaLabel, scrollRef, children }) {
    return (
        <div className="book-m__carousel-block">
            <p className={`book-m__carousel-label ${labelClass}`.trim()}>{label}</p>
            <div className="book-m__carousel-wrap">
                <button
                    type="button"
                    className="book-m__carousel-arrow book-m__carousel-arrow--left"
                    aria-label={`${label} — солға`}
                    onClick={() => scrollCarousel(scrollRef.current, -1)}
                >
                    <span className="book-m__carousel-arrow-glyph" aria-hidden="true">‹</span>
                </button>
                <div className="book-m__carousel-viewport">
                    <div className="book-m__carousel" ref={scrollRef} role="listbox" aria-label={ariaLabel}>
                        {children}
                    </div>
                </div>
                <button
                    type="button"
                    className="book-m__carousel-arrow book-m__carousel-arrow--right"
                    aria-label={`${label} — оңға`}
                    onClick={() => scrollCarousel(scrollRef.current, 1)}
                >
                    <span className="book-m__carousel-arrow-glyph" aria-hidden="true">›</span>
                </button>
            </div>
        </div>
    );
}

function centerActiveChip(container) {
    if (!container) return;
    const active = container.querySelector(".book-m__date-chip--active, .book-m__time-chip--active");
    active?.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
}

function HeroWave() {
    return (
        <svg className="doc-m__hero-wave" viewBox="0 0 280 200" fill="none" aria-hidden="true">
            <path d="M40 160C80 120 120 180 160 140C200 100 240 150 280 110V200H0V120C12 138 24 152 40 160Z" fill="rgba(255,255,255,0.18)" />
            <path d="M60 130C100 100 140 150 180 115C210 90 250 125 280 95V200H20V145C32 138 46 134 60 130Z" fill="rgba(255,255,255,0.1)" />
        </svg>
    );
}

export default function Book() {
    const { doctorId } = useParams();
    const nav = useNavigate();
    const [doc, setDoc] = useState(null);
    const [me, setMe] = useState(null);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const dateCarouselRef = useRef(null);
    const timeCarouselRef = useRef(null);

    const dateOptions = useMemo(() => buildDateOptions(21), []);

    useEffect(() => {
        if (!token()) {
            nav("/login");
            return;
        }
        api(`/api/v1/doctors/${doctorId}`)
            .then(setDoc)
            .catch((e) => setMsg("Қате: " + e.message));
        api("/api/v1/me", { auth: true })
            .then(setMe)
            .catch(() => setMe(null));
    }, [doctorId, nav]);

    useEffect(() => {
        document.body.classList.toggle("doc-detail-mobile-open", menuOpen);
        return () => document.body.classList.remove("doc-detail-mobile-open");
    }, [menuOpen]);

    useEffect(() => {
        if (!date && dateOptions.length) {
            setDate(dateOptions[0].value);
        }
    }, [date, dateOptions]);

    useEffect(() => {
        setTime("");
        if (!date) {
            setSlots([]);
            return;
        }
        setSlotsLoading(true);
        setSlots([]);
        setMsg("");
        api(`/api/v1/doctors/${doctorId}/slots?date=${date}`)
            .then((data) => setSlots(data.slots || []))
            .catch((e) => {
                setSlots([]);
                setMsg("Уақыт слоттарын жүктеу кезінде қате: " + (e.message || "серверге қосылу мүмкін емес"));
            })
            .finally(() => setSlotsLoading(false));
    }, [date, doctorId]);

    useEffect(() => {
        centerActiveChip(dateCarouselRef.current);
    }, [date]);

    useEffect(() => {
        if (!slotsLoading) {
            centerActiveChip(timeCarouselRef.current);
        }
    }, [time, slotsLoading, slots]);

    function toRFC3339(dateStr, timeStr) {
        if (!dateStr || !timeStr) return "";
        const t = timeStr.length === 5 ? timeStr : timeStr.slice(0, 5);
        return `${dateStr}T${t}:00+05:00`;
    }

    async function submit() {
        setMsg("");
        setSubmitting(true);
        try {
            const start_at = toRFC3339(date, time);
            await api("/api/v1/appointments", {
                method: "POST",
                auth: true,
                body: {
                    doctor_user_id: doc.user_id,
                    start_at,
                    note: "",
                },
            });
            nav("/profile", { state: { fromBook: true } });
        } catch (e) {
            setMsg("Қате: " + e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const userInitials = getInitials(me?.full_name || me?.phone || "U");
    const selectedDateLabel = dateOptions.find((d) => d.value === date)?.full || "";
    const price = Number(doc?.price || 0);

    if (!doc && !msg) {
        return (
            <div className="page book-page-v2">
                <div className="doc-m">
                    <p className="book-m__loading">Жүктелуде...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page book-page-v2">
            <div className="doc-m doc-m--book">
                <header className="doc-m__topbar">
                    <Link className="doc-m__brand" to="/" onClick={() => setMenuOpen(false)}>
                        <img src="/img/logo.png" alt="" className="doc-m__logo" />
                        <span className="doc-m__app-name">Janynda</span>
                    </Link>
                    <div className="doc-m__actions">
                        <button
                            type="button"
                            className="doc-m__icon-btn doc-m__icon-btn--menu"
                            aria-label={menuOpen ? "Мәзірді жабу" : "Мәзірді ашу"}
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen((v) => !v)}
                        >
                            <IconMenu />
                        </button>
                        <Link to="/notifications" className="doc-m__icon-btn doc-m__icon-btn--bell" aria-label="Ескертулер">
                            <IconBell />
                        </Link>
                        <Link to="/profile" className="doc-m__avatar" aria-label="Профиль">
                            {me?.avatar_url ? (
                                <img src={normalizePhoto(me.avatar_url)} alt="" />
                            ) : (
                                userInitials
                            )}
                        </Link>
                    </div>
                </header>

                {menuOpen && (
                    <>
                        <div className="doc-m__menu-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                        <nav className="doc-m__menu-panel" aria-label="Мобильді мәзір">
                            <p className="doc-m__menu-title">Мәзір</p>
                            <Link className="doc-m__menu-link" to="/" onClick={() => setMenuOpen(false)}>Басты бет</Link>
                            <Link className="doc-m__menu-link" to="/doctors" onClick={() => setMenuOpen(false)}>Дәрігерлер</Link>
                            <Link className="doc-m__menu-link" to="/news" onClick={() => setMenuOpen(false)}>Жаңалықтар</Link>
                            <Link className="doc-m__menu-link" to="/profile" onClick={() => setMenuOpen(false)}>Профиль</Link>
                        </nav>
                    </>
                )}

                <div className="doc-m__body doc-m__body--book">
                    <section className="doc-m__hero" aria-label="Жазылу">
                        <HeroWave />
                        <div className="doc-m__hero-dots" aria-hidden="true" />
                        <div className="doc-m__hero-blob doc-m__hero-blob--1" aria-hidden="true" />
                        <div className="doc-m__hero-blob doc-m__hero-blob--2" aria-hidden="true" />
                        <h1 className="doc-m__hero-title">ДӘРІГЕРГЕ ЖАЗЫЛУ</h1>
                    </section>

                    <p className="book-m__intro">
                        Күн мен уақытты таңдаңыз, біз сізге жазылуды растаймыз.
                    </p>

                    {doc && (
                        <div className="doc-m__profile-wrap">
                            <div className="doc-m__profile-card">
                                <div className="doc-m__avatar-wrap">
                                    <img
                                        src={normalizePhoto(doc.avatar_url || doc.photo_url)}
                                        alt={doc.full_name}
                                        className="doc-m__avatar-img"
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = NO_AVATAR;
                                        }}
                                    />
                                    <span className="doc-m__verified" aria-label="Расталған дәрігер">
                                        <IconCheck />
                                    </span>
                                </div>
                                <p className="book-m__doctor-tag">ДӘРІГЕР</p>
                                <h2 className="doc-m__name">{doc.full_name}</h2>
                                <div className="doc-m__pills">
                                    <span className="doc-m__pill">{doc.specialty || "Мамандық көрсетілмеген"}</span>
                                    {price > 0 && (
                                        <span className="doc-m__pill doc-m__pill--price">
                                            Қабылдау: {price.toLocaleString("kk-KZ")} ₸
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <section className="book-m__picker" aria-label="Күн мен уақыт">
                        <h3 className="book-m__picker-title">Күн мен уақытты таңдаңыз</h3>

                        <CarouselWithArrows
                            label="Күн"
                            ariaLabel="Күнді таңдау"
                            scrollRef={dateCarouselRef}
                        >
                            {dateOptions.map((d) => (
                                <button
                                    key={d.value}
                                    type="button"
                                    role="option"
                                    aria-selected={date === d.value}
                                    className={`book-m__date-chip ${date === d.value ? "book-m__date-chip--active" : ""}`}
                                    onClick={() => setDate(d.value)}
                                >
                                    <span className="book-m__date-chip-weekday">{d.weekday}</span>
                                    <span className="book-m__date-chip-day">{d.day}</span>
                                    <span className="book-m__date-chip-month">{d.month}</span>
                                </button>
                            ))}
                        </CarouselWithArrows>

                        {slotsLoading ? (
                            <p className="book-m__slots-hint book-m__slots-hint--time">Уақыт слоттары жүктелуде...</p>
                        ) : slots.length > 0 ? (
                            <CarouselWithArrows
                                label="Уақыт"
                                labelClass="book-m__carousel-label--time"
                                ariaLabel="Уақытты таңдау"
                                scrollRef={timeCarouselRef}
                            >
                                {slots.map((slot) => (
                                    <button
                                        key={slot}
                                        type="button"
                                        role="option"
                                        aria-selected={time === slot}
                                        className={`book-m__time-chip ${time === slot ? "book-m__time-chip--active" : ""}`}
                                        onClick={() => setTime(slot)}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </CarouselWithArrows>
                        ) : date ? (
                            <p className="book-m__slots-hint">Бұл күні ({selectedDateLabel}) бос уақыт жоқ.</p>
                        ) : (
                            <p className="book-m__slots-hint">Алдымен күнді таңдаңыз.</p>
                        )}
                    </section>

                    {msg && <p className="book-m__error" role="alert">{msg}</p>}
                </div>

                <div className="book-m__footer">
                    <button
                        type="button"
                        className="doc-m__cta"
                        onClick={submit}
                        disabled={!date || !time || submitting || !doc}
                    >
                        <IconCalendar />
                        {submitting ? "Жіберілуде..." : "Жазылу"}
                    </button>
                </div>
            </div>
        </div>
    );
}
