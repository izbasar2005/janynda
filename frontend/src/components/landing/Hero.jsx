import { Link } from "react-router-dom";

const benefits = [
    "Онлайн жазылу — уақытты үнемдеңіз",
    "Сенімді дәрігерлер — тексерілген мамандар",
    "Қауіпсіз деректер — жеке ақпарат қорғалады",
];

export default function Hero() {
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
            <div className="landing-hero__search-card card">
                <h3 className="landing-hero__search-title">Дәрігерді іздеу</h3>
                <p className="muted landing-hero__search-desc">
                    Қала, мамандық немесе дәрігер аты бойынша іздеңіз.
                </p>
                <div className="landing-hero__search-fields">
                    <div className="form-field">
                        <label className="form-label">Қала</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Мысалы: Алматы"
                            readOnly
                            aria-readonly="true"
                        />
                    </div>
                    <div className="form-field">
                        <label className="form-label">Мамандық</label>
                        <select className="input" defaultValue="" aria-readonly="true">
                            <option value="">Барлығы</option>
                            <option value="therapist">Терапевт</option>
                            <option value="pediatrician">Педиатр</option>
                            <option value="cardiologist">Кардиолог</option>
                            <option value="dentist">Тіс дәрігері</option>
                        </select>
                    </div>
                    <div className="form-field">
                        <label className="form-label">Дәрігер аты</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Аты-жөні"
                            readOnly
                            aria-readonly="true"
                        />
                    </div>
                </div>
                <Link className="btn landing-hero__search-btn" to="/doctors">
                    Іздеу
                </Link>
            </div>
        </section>
    );
}
