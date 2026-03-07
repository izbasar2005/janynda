import { useState } from "react";
import { Link } from "react-router-dom";

const benefits = [
    "Онлайн жазылу — уақытты үнемдеңіз",
    "Сенімді дәрігерлер — тексерілген мамандар",
    "Қауіпсіз деректер — жеке ақпарат қорғалады",
];

const HERO_IMAGE = "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80";

export default function Hero() {
    const [imgError, setImgError] = useState(false);

    return (
        <section className="landing-hero">
            <div className="landing-hero__content">
                <h1 className="landing-hero__title">
                    Дәрігерге онлайн жазылу
                </h1>
                <p className="landing-hero__desc">
                    Janymda — заманауи медициналық платформа. Дәрігерді таңдаңыз,
                    ыңғайлы уақытты белгілеңіз және қауіпсіз түрде жазылыңыз.
                </p>
                <ul className="landing-hero__benefits">
                    {benefits.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
                <div className="landing-hero__actions">
                    <Link className="btn" to="/doctors">
                        Дәрігерді таңдау
                    </Link>
                    <Link className="btn ghost" to="/register">
                        Тіркелу
                    </Link>
                </div>
            </div>
            <div className="landing-hero__visual">
                <div className="landing-hero__image-wrap">
                    {!imgError ? (
                        <img
                            src={HERO_IMAGE}
                            alt="Медициналық көмек — дәрігер мен пациент"
                            className="landing-hero__image"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="landing-hero__placeholder">
                            <span className="landing-hero__placeholder-icon" aria-hidden="true">🏥</span>
                            <p className="landing-hero__placeholder-text">Медициналық көмек</p>
                            <p className="landing-hero__placeholder-desc">Дәрігер мен пациент</p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
