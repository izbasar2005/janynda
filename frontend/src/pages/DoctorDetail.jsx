import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function fmtDate(s) {
    if (!s) return "—";
    try {
        return new Date(s).toLocaleDateString("kk-KZ", { day: "numeric", month: "long", year: "numeric" });
    } catch {
        return String(s);
    }
}

function getInitials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "U";
    const a = (parts[0]?.[0] || "U").toUpperCase();
    const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
    return (a + b).slice(0, 2);
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

function HeroWave() {
    return (
        <svg className="doc-m__hero-wave" viewBox="0 0 280 200" fill="none" aria-hidden="true">
            <path
                d="M40 160C80 120 120 180 160 140C200 100 240 150 280 110V200H0V120C12 138 24 152 40 160Z"
                fill="rgba(255,255,255,0.18)"
            />
            <path
                d="M60 130C100 100 140 150 180 115C210 90 250 125 280 95V200H20V145C32 138 46 134 60 130Z"
                fill="rgba(255,255,255,0.1)"
            />
        </svg>
    );
}

function Stars({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return (
        <span className="doctor-detail-stars" aria-label={`${r} жұлдыз`}>
            {"★".repeat(r)}{"☆".repeat(5 - r)}
        </span>
    );
}

const TAB_REVIEWS = "reviews";
const TAB_ABOUT = "about";

function TabContent({
    activeTab,
    doc,
    price,
    reviewsList,
    canReview,
    showReviewForm,
    setShowReviewForm,
    reviewRating,
    setReviewRating,
    reviewText,
    setReviewText,
    submitReview,
    submitMsg,
}) {
    if (activeTab === TAB_REVIEWS) {
        return (
            <div className="doc-m__content">
                {canReview && (
                    <div className="doctor-detail__review-section">
                        {!showReviewForm ? (
                            <button type="button" className="btn ghost" onClick={() => setShowReviewForm(true)}>
                                Пікір қалдыру
                            </button>
                        ) : (
                            <form onSubmit={submitReview} className="doctor-detail-review-form doc-m__review-form">
                                <label className="form-label">Рейтинг (1–5)</label>
                                <div className="doctor-detail-stars-input">
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <button
                                            key={n}
                                            type="button"
                                            className={reviewRating >= n ? "is-active" : ""}
                                            onClick={() => setReviewRating(n)}
                                            aria-label={`${n} жұлдыз`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                                <label className="form-label">Пікір (міндетсіз)</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    placeholder="Пікіріңізді жазыңыз"
                                />
                                <div className="doctor-detail-review-form-actions doc-m__review-form-actions">
                                    <button type="submit" className="btn">Жіберу</button>
                                    <button type="button" className="btn ghost" onClick={() => setShowReviewForm(false)}>
                                        Болдырмау
                                    </button>
                                </div>
                                {submitMsg && <p className="form-error">{submitMsg}</p>}
                            </form>
                        )}
                    </div>
                )}

                {reviewsList.length === 0 ? (
                    <p className="doc-m__empty">Әзірге пікір жоқ.</p>
                ) : (
                    <ul className="doc-m__review-list">
                        {reviewsList.map((r) => (
                            <li key={r.id} className="doc-m__review-card">
                                <div className="doc-m__review-head">
                                    <span className="doc-m__review-name">
                                        {(r.patient && r.patient.full_name) || "Пациент"}
                                    </span>
                                    <span className="doc-m__review-date">{fmtDate(r.created_at)}</span>
                                </div>
                                <div className="doctor-detail-review-card__rating">
                                    <Stars rating={r.rating} />
                                </div>
                                {r.text && <p className="doc-m__review-text">{r.text}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    }

    return (
        <div className="doc-m__content">
            <div className="doc-m__about-card">
                <h3 className="doc-m__about-title">Ақпарат</h3>
                <dl>
                    <div className="doc-m__about-row">
                        <dt>Тәжірибе</dt>
                        <dd>{Number(doc.experience || 0)} жыл</dd>
                    </div>
                    <div className="doc-m__about-row">
                        <dt>Бағасы</dt>
                        <dd>{price} ₸</dd>
                    </div>
                    {doc.education && (
                        <div className="doc-m__about-row">
                            <dt>Білімі</dt>
                            <dd>{doc.education}</dd>
                        </div>
                    )}
                    {doc.languages && (
                        <div className="doc-m__about-row">
                            <dt>Тілдері</dt>
                            <dd>{doc.languages}</dd>
                        </div>
                    )}
                </dl>
                <p className="doc-m__specialty">
                    <strong>Мамандығы:</strong> {doc.specialty || "—"}
                </p>
            </div>
        </div>
    );
}

export default function DoctorDetail() {
    const { id } = useParams();
    const [doc, setDoc] = useState(null);
    const [reviews, setReviews] = useState({ average_rating: 0, total: 0, reviews: [] });
    const [myReviewIds, setMyReviewIds] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [me, setMe] = useState(null);
    const [msg, setMsg] = useState("");
    const [activeTab, setActiveTab] = useState(TAB_REVIEWS);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState("");
    const [submitMsg, setSubmitMsg] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        api(`/api/v1/doctors/${id}`)
            .then(setDoc)
            .catch((e) => setMsg("Дәрігер табылмады: " + e.message));
    }, [id]);

    useEffect(() => {
        if (!id) return;
        api(`/api/v1/doctors/${id}/reviews`)
            .then(setReviews)
            .catch(() => setReviews({ average_rating: 0, total: 0, reviews: [] }));
    }, [id]);

    useEffect(() => {
        const t = token();
        if (!t) return;
        api("/api/v1/me", { auth: true })
            .then((u) => {
                setMe(u);
                if (u?.role !== "patient") return;
                api("/api/v1/appointments/my", { auth: true })
                    .then((d) => setAppointments(Array.isArray(d) ? d : []))
                    .catch(() => setAppointments([]));
                api("/api/v1/reviews/my", { auth: true })
                    .then((data) => setMyReviewIds(data.doctor_user_ids || []))
                    .catch(() => setMyReviewIds([]));
            })
            .catch(() => setMe(null));
    }, []);

    useEffect(() => {
        document.body.classList.toggle("doc-detail-mobile-open", menuOpen);
        return () => document.body.classList.remove("doc-detail-mobile-open");
    }, [menuOpen]);

    const hasAppointment = doc && me?.role === "patient" && appointments.some((a) => Number(a.doctor_user_id) === Number(doc.user_id));
    const alreadyReviewed = doc && myReviewIds.includes(Number(doc.user_id));
    const canReview = hasAppointment && !alreadyReviewed;
    const reviewsList = reviews.reviews || [];

    async function submitReview(e) {
        e.preventDefault();
        setSubmitMsg("");
        if (!doc) return;
        try {
            await api("/api/v1/reviews", {
                method: "POST",
                auth: true,
                body: { doctor_user_id: doc.user_id, rating: reviewRating, text: reviewText.trim() },
            });
            setShowReviewForm(false);
            setReviewText("");
            setReviewRating(5);
            setMyReviewIds((prev) => [...prev, doc.user_id]);
            const res = await api(`/api/v1/doctors/${id}/reviews`);
            setReviews(res);
        } catch (err) {
            setSubmitMsg(err.message || "Қате");
        }
    }

    if (msg) {
        return (
            <div className="page">
                <p className="form-error">{msg}</p>
                <Link to="/doctors">← Дәрігерлер тізімі</Link>
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="page">
                <p className="muted">Жүктелуде...</p>
            </div>
        );
    }

    const photoSrc = normalizePhoto(doc.avatar_url || doc.photo_url);
    const avg = reviews.average_rating != null ? Number(reviews.average_rating).toFixed(1) : "0";
    const price = Number(doc.price || 0);
    const doctorName = doc.full_name || "Аты көрсетілмеген";
    const userInitials = getInitials(me?.full_name || me?.phone || "");
    const t = token();

    const tabProps = {
        activeTab,
        doc,
        price,
        reviewsList,
        canReview,
        showReviewForm,
        setShowReviewForm,
        reviewRating,
        setReviewRating,
        reviewText,
        setReviewText,
        submitReview,
        submitMsg,
    };

    const heroName = (doc.full_name || "ДӘРІГЕР").toUpperCase();
    const avatarLetter = t ? userInitials : "U";

    const bookAction = !t ? (
        <Link to="/login" className="doc-m__cta">
            <IconCalendar />
            Кіру
        </Link>
    ) : me?.role === "patient" || me?.role === "user" ? (
        <Link to={`/book/${doc.id}`} className="doc-m__cta">
            <IconCalendar />
            Жазылу
        </Link>
    ) : null;

    return (
        <div className="page doctor-detail-page-v2">
            <div className="doc-m">
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
                        <Link
                            to={t ? "/notifications" : "/login"}
                            className="doc-m__icon-btn doc-m__icon-btn--bell"
                            aria-label="Ескертулер"
                        >
                            <IconBell />
                        </Link>
                        <Link to={t ? "/profile" : "/login"} className="doc-m__avatar" aria-label="Профиль">
                            {t && me?.avatar_url ? (
                                <img src={normalizePhoto(me.avatar_url)} alt="" />
                            ) : (
                                avatarLetter
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
                            {t ? (
                                <Link className="doc-m__menu-link" to="/profile" onClick={() => setMenuOpen(false)}>Профиль</Link>
                            ) : (
                                <Link className="doc-m__menu-link" to="/login" onClick={() => setMenuOpen(false)}>Кіру</Link>
                            )}
                        </nav>
                    </>
                )}

                <div className="doc-m__body">
                    <section className="doc-m__hero" aria-label="Дәрігер">
                        <HeroWave />
                        <div className="doc-m__hero-dots" aria-hidden="true" />
                        <div className="doc-m__hero-blob doc-m__hero-blob--1" aria-hidden="true" />
                        <div className="doc-m__hero-blob doc-m__hero-blob--2" aria-hidden="true" />
                        <h1 className="doc-m__hero-title">{heroName}</h1>
                    </section>

                    <div className="doc-m__profile-wrap">
                        <div className="doc-m__profile-card">
                            <div className="doc-m__avatar-wrap">
                                <img
                                    src={photoSrc}
                                    alt={doctorName}
                                    className="doc-m__avatar-img"
                                    onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = NO_AVATAR; }}
                                />
                                <span className="doc-m__verified" aria-label="Расталған дәрігер">
                                    <IconCheck />
                                </span>
                            </div>
                            <h2 className="doc-m__name">{doctorName}</h2>
                            <div className="doc-m__pills">
                                <span className="doc-m__pill">Тәжірибе: {Number(doc.experience || 0)} жыл</span>
                                <span className="doc-m__pill doc-m__pill--price">
                                    Қабылдау: {price.toLocaleString("kk-KZ")} ₸
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="doc-m__stats-bar">
                        <div className="doc-m__stats-item">
                            <span className="doc-m__stats-icon doc-m__stats-icon--star" aria-hidden="true">⭐</span>
                            <div className="doc-m__stats-text">
                                <span className="doc-m__stats-value">{avg}</span>
                                <span className="doc-m__stats-label">Рейтинг</span>
                            </div>
                        </div>
                        <div className="doc-m__stats-divider" aria-hidden="true" />
                        <div className="doc-m__stats-item">
                            <span className="doc-m__stats-icon doc-m__stats-icon--chat" aria-hidden="true">💬</span>
                            <div className="doc-m__stats-text">
                                <span className="doc-m__stats-value">{reviews.total}</span>
                                <span className="doc-m__stats-label">Пікірлер</span>
                            </div>
                        </div>
                    </div>

                    {bookAction && <div className="doc-m__cta-wrap">{bookAction}</div>}

                    <TabContent {...tabProps} />
                </div>

                <nav className="doc-m__bottom-tabs" role="tablist" aria-label="Дәрігер бөлімдері">
                    <div className="doc-m__bottom-tabs-inner">
                        <span
                            className={`doc-m__bottom-indicator ${activeTab === TAB_ABOUT ? "doc-m__bottom-indicator--about" : ""}`}
                            aria-hidden="true"
                        />
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === TAB_REVIEWS}
                            className={`doc-m__bottom-tab ${activeTab === TAB_REVIEWS ? "doc-m__bottom-tab--active" : ""}`}
                            onClick={() => setActiveTab(TAB_REVIEWS)}
                        >
                            Пікірлер
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === TAB_ABOUT}
                            className={`doc-m__bottom-tab ${activeTab === TAB_ABOUT ? "doc-m__bottom-tab--active" : ""}`}
                            onClick={() => setActiveTab(TAB_ABOUT)}
                        >
                            Дәрігер туралы
                        </button>
                    </div>
                </nav>
            </div>
        </div>
    );
}
