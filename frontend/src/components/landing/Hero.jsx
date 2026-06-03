import { useState } from "react";
import { Link } from "react-router-dom";

const benefits = [
    "Онлайн жазылу — уақытты үнемдеңіз",
    "Сенімді дәрігерлер — тексерілген мамандар",
    "Қауіпсіз деректер — жеке ақпарат қорғалады",
];

const HERO_IMAGE = "/img/doctor.png";

export default function Hero() {
    const [imgError, setImgError] = useState(false);

    return (
        <section className="landing-hero" aria-labelledby="landing-hero-title">
            <div className="landing-hero__bg" aria-hidden="true" />
            <div className="landing-hero__inner container">
                <div className="landing-hero__content">
                    <span className="landing-hero__badge">Медициналық платформа</span>
                    <h1 id="landing-hero-title" className="landing-hero__title">
                        Дәрігерге онлайн жазылу
                    </h1>
                    <p className="landing-hero__desc">
                        Janynda — заманауи медициналық платформа. Дәрігерді таңдаңыз,
                        ыңғайлы уақытты белгілеңіз және қауіпсіз түрде жазылыңыз.
                    </p>
                    <ul className="landing-hero__benefits">
                        {benefits.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                    <div className="landing-hero__actions">
                        <Link className="btn btn--block-sm" to="/doctors">
                            Дәрігерді таңдау
                        </Link>
                        <Link className="btn ghost btn--block-sm" to="/register">
                            Тіркелу
                        </Link>
                    </div>
                </div>
                <div className="landing-hero__visual" aria-hidden={imgError}>
                    <div className="landing-hero__image-wrap">
                        {!imgError ? (
                            <img
                                src={HERO_IMAGE}
                                alt=""
                                className="landing-hero__image"
                                width={400}
                                height={400}
                                decoding="async"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="landing-hero__placeholder">
                                <span className="landing-hero__placeholder-icon" aria-hidden="true">
                                    🏥
                                </span>
                                <p className="landing-hero__placeholder-text">Медициналық көмек</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
