import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NO_AVATAR, normalizePhoto } from "../utils/doctorPhoto";

function DoctorPhoto({ src, alt }) {
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
                className="doc-card__img"
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

function CardInfo({ full_name, specialty, experience, price, avgRating }) {
    return (
        <div className="doc-card__body">
            <h3 className="doc-card__name">{full_name || "Аты көрсетілмеген"}</h3>
            <p className="doc-card__spec">{specialty || "Мамандығы жоқ"}</p>
            <div className="doc-card__meta-line">
                {avgRating != null && (
                    <span className="doc-card__rating" aria-label={`Рейтинг ${avgRating}`}>
                        ★ {avgRating}
                    </span>
                )}
                <span className="doc-card__exp">{Number(experience)} жыл</span>
            </div>
            <p className="doc-card__price">
                <strong>{Number(price)} ₸</strong>
            </p>
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
    const detailTo = `/doctors/${Number(id)}`;
    const isLanding = variant === "landing";
    const label = `${full_name || "Дәрігер"} — ${specialty || "профиль"}`;

    const info = (
        <CardInfo
            full_name={full_name}
            specialty={specialty}
            experience={experience}
            price={price}
            avgRating={avgRating}
        />
    );

    if (isLanding) {
        return (
            <Link
                to={detailTo}
                className="doc-card doc-card--link doc-card--landing doc-card--compact card card--interactive"
                aria-label={label}
            >
                <DoctorPhoto src={avatar_url || photo_url} alt="" />
                {info}
            </Link>
        );
    }

    return (
        <article className="doc-card doc-card--page doc-card--compact card card--interactive">
            <Link to={detailTo} className="doc-card__hitarea" aria-label={label}>
                <DoctorPhoto src={avatar_url || photo_url} alt="" />
                {info}
            </Link>
            <div className="doc-card__actions doc-card__actions--desktop">
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
        </article>
    );
}
