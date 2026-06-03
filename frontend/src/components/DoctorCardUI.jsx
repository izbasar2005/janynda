import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NO_AVATAR, normalizePhoto } from "../utils/doctorPhoto";

function fmtDate(s) {
    if (!s) return "";
    try {
        return new Date(s).toLocaleDateString("kk-KZ", { day: "numeric", month: "short", year: "numeric" });
    } catch {
        return "";
    }
}

function Stars({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return <span className="doc-card__chip doc-card__chip--rating">{"★".repeat(r)}{"☆".repeat(5 - r)}</span>;
}

function DoctorPhoto({ src, alt, className = "doc-card__img" }) {
    const imgRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const photo = normalizePhoto(src);

    useEffect(() => {
        setLoaded(false);
    }, [photo]);

    useEffect(() => {
        if (imgRef.current?.complete) setLoaded(true);
    }, [photo]);

    return (
        <div className="doc-card__media">
            {!loaded && (
                <div
                    className="doc-card__media-skeleton"
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(90deg, #f1f5f9, #e2e8f0, #f1f5f9)",
                    }}
                />
            )}
            <img
                ref={imgRef}
                src={photo}
                alt={alt}
                className={className}
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = NO_AVATAR;
                    setLoaded(true);
                }}
            />
        </div>
    );
}

/** @param {"landing"|"page"} variant */
export default function DoctorCardUI({ doctor, role = "guest", reviewsData, variant = "page" }) {
    const d = doctor || {};
    const {
        full_name,
        specialty,
        experience = 0,
        price = 0,
        photo_url,
        avatar_url,
        id,
    } = d;

    const avgRating =
        reviewsData?.average_rating != null ? Number(reviewsData.average_rating).toFixed(1) : null;
    const lastReview = reviewsData?.reviews?.[0];
    const detailTo = `/doctors/${Number(id)}`;
    const isLanding = variant === "landing";

    const body = (
        <>
            <DoctorPhoto src={avatar_url || photo_url} alt={full_name || "Дәрігер"} />
            <div className="doc-card__body">
                <h3 className="doc-card__name">
                    {isLanding ? (
                        full_name || "Аты көрсетілмеген"
                    ) : (
                        <Link to={detailTo} className="doc-card__name-link">
                            {full_name || "Аты көрсетілмеген"}
                        </Link>
                    )}
                </h3>
                <p className="doc-card__spec">{specialty || "Мамандығы көрсетілмеген"}</p>
                <div className="doc-card__chips">
                    <span className="doc-card__chip">{Number(experience)} жыл тәжірибе</span>
                    {avgRating != null && (
                        <span className="doc-card__chip doc-card__chip--rating" aria-label={`Рейтинг ${avgRating}`}>
                            ★ {avgRating}
                        </span>
                    )}
                </div>
                <p className="doc-card__price">
                    Қабылдау: <strong>{Number(price)} ₸</strong>
                </p>
                {isLanding && <span className="doc-card__cta">Профильді көру →</span>}
                {isLanding && lastReview && (
                    <div className="doc-card__review">
                        <div>
                            <strong>{(lastReview.patient && lastReview.patient.full_name) || "Пациент"}</strong>
                            {lastReview.created_at && (
                                <span> · {fmtDate(lastReview.created_at)}</span>
                            )}
                        </div>
                        {lastReview.rating != null && <Stars rating={lastReview.rating} />}
                        {lastReview.text && (
                            <p className="doc-card__review-text">{lastReview.text}</p>
                        )}
                    </div>
                )}
                {!isLanding && (
                    <div className="doc-card__actions">
                        <Link to={detailTo} className="btn ghost">
                            Толығырақ
                        </Link>
                        {role === "guest" ? (
                            <Link to="/login" className="btn">
                                Кіру
                            </Link>
                        ) : role === "patient" || role === "user" ? (
                            <Link to={`/book/${Number(id)}`} className="btn">
                                Жазылу
                            </Link>
                        ) : (
                            <span className="muted doc-card__only-patient">Тек пациент</span>
                        )}
                    </div>
                )}
            </div>
        </>
    );

    if (isLanding) {
        return (
            <Link
                to={detailTo}
                className={`doc-card doc-card--link doc-card--landing card card--interactive`}
                aria-label={`${full_name || "Дәрігер"} — профильді көру`}
            >
                {body}
            </Link>
        );
    }

    return <article className="doc-card doc-card--page card card--interactive">{body}</article>;
}
