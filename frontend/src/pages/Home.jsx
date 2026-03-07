import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, token } from "../services/api";
import Hero from "../components/landing/Hero";
import SpecialtyCard from "../components/landing/SpecialtyCard";
import DoctorCard from "../components/landing/DoctorCard";
import TestimonialCard from "../components/landing/TestimonialCard";
import FAQItem from "../components/landing/FAQItem";

const SPECIALTIES = [
    { iconKey: "therapist", title: "Терапевт", description: "Жалпы емдеу, науқастың бастапқы тексеруі", doctorCount: 12 },
    { iconKey: "pediatrician", title: "Педиатр", description: "Балалар денсаулығы және дамуы", doctorCount: 8 },
    { iconKey: "cardiologist", title: "Кардиолог", description: "Жүрек-қан тамырлары жүйесі", doctorCount: 6 },
    { iconKey: "dentist", title: "Тіс дәрігері", description: "Стоматология және тіс емдеу", doctorCount: 10 },
];

const FAQ_DATA = [
    { q: "Онлайн жазылу қалай жұмыс істейді?", a: "Сіз дәрігерді таңдап, күн мен уақытты белгілейсіз. Растау SMS арқылы келеді. Тіркелу үшін платформада тіркелу керек." },
    { q: "Жазылуды болдырмауға бола ма?", a: "Иә. Жазылуды кейінге қалдыру немесе болдырмау мүмкіндігі бар. Профиль бөлімінде өз жазылуларыңызды басқара аласыз." },
    { q: "Деректерім қауіпсіз бе?", a: "Иә. Барлық деректер шифрланған байланыс арқылы өтеді. Жеке ақпаратты сақтау саясатымызға сәйкес қорғалады." },
    { q: "Төлем қалай жүзеге асырылады?", a: "Қазіргі кезде төлем кездесу кезінде дәрігерге төленеді. Онлайн төлем болашақта қосылады." },
];

export default function Home() {
    const [doctors, setDoctors] = useState([]);
    const [reviewsByDoctorId, setReviewsByDoctorId] = useState({});
    const [platformFeedbacks, setPlatformFeedbacks] = useState([]);
    const [me, setMe] = useState(null);
    const [testimonialIndex, setTestimonialIndex] = useState(0);
    const [faqOpenIndex, setFaqOpenIndex] = useState(null);
    const [showFeedbackForm, setShowFeedbackForm] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackMsg, setFeedbackMsg] = useState("");

    useEffect(() => {
        api("/api/v1/doctors")
            .then((d) => {
                const arr = Array.isArray(d) ? d : [];
                setDoctors(arr.slice(0, 6));
            })
            .catch(() => setDoctors([]));
    }, []);

    useEffect(() => {
        const opts = token() ? { auth: true } : {};
        api("/api/v1/feedback", opts)
            .then((data) => setPlatformFeedbacks(Array.isArray(data) ? data : []))
            .catch(() => setPlatformFeedbacks([]));
    }, [me]);

    useEffect(() => {
        if (!token()) {
            setMe(null);
            return;
        }
        api("/api/v1/me", { auth: true })
            .then((u) => setMe(u || null))
            .catch(() => setMe(null));
    }, []);

    useEffect(() => {
        const n = platformFeedbacks.length;
        if (n > 0 && testimonialIndex >= n) setTestimonialIndex(0);
    }, [platformFeedbacks.length, testimonialIndex]);

    useEffect(() => {
        if (doctors.length === 0) return;
        Promise.all(
            doctors.map((d) =>
                api(`/api/v1/doctors/${d.id}/reviews`).then((data) => ({ id: d.id, data })).catch(() => ({ id: d.id, data: { average_rating: 0, total: 0, reviews: [] } }))
            )
        ).then((results) => {
            const byId = {};
            results.forEach(({ id, data }) => { byId[id] = data; });
            setReviewsByDoctorId(byId);
        });
    }, [doctors]);

    const feedbacksCount = platformFeedbacks.length;
    const nextTestimonial = () => setTestimonialIndex((i) => (i + 1) % Math.max(1, feedbacksCount));
    const prevTestimonial = () => setTestimonialIndex((i) => (i - 1 + feedbacksCount) % Math.max(1, feedbacksCount));

    function loadFeedbacks() {
        const opts = token() ? { auth: true } : {};
        api("/api/v1/feedback", opts)
            .then((data) => setPlatformFeedbacks(Array.isArray(data) ? data : []))
            .catch(() => setPlatformFeedbacks([]));
    }

    function handleDeleteFeedback(id) {
        if (!window.confirm("Пікірді өшіргіңіз келетініне сенімдісіз бе?")) return;
        api(`/api/v1/feedback/${id}`, { method: "DELETE", auth: true })
            .then(() => {
                loadFeedbacks();
                setTestimonialIndex(0);
            })
            .catch((err) => alert(err.message || "Қате"));
    }

    function handleFeedbackSubmit(e) {
        e.preventDefault();
        setFeedbackMsg("");
        const text = (feedbackText || "").trim();
        if (!text) {
            setFeedbackMsg("Пікір мәтінін енгізіңіз.");
            return;
        }
        if (!token()) {
            setFeedbackMsg("Пікір қалдыру үшін жүйеге кіріңіз.");
            return;
        }
        api("/api/v1/feedback", {
            method: "POST",
            auth: true,
            body: { text },
        })
            .then(() => {
                setFeedbackMsg("Рақмет! Пікіріңіз қабылданды.");
                setFeedbackText("");
                setShowFeedbackForm(false);
                loadFeedbacks();
                setTestimonialIndex(0);
            })
            .catch((err) => {
                const msg = err.message || "";
                setFeedbackMsg(msg.includes("401") || msg.includes("кіріңіз") ? "Пікір қалдыру үшін жүйеге кіріңіз." : msg);
            });
    }

    return (
        <div className="landing-page">
            <Hero />

            <section className="landing-section landing-specialties">
                <h2 className="landing-section__title">Мамандықтар</h2>
                <p className="landing-section__subtitle muted">
                    Танымал мамандықтар бойынша дәрігерлерді таңдаңыз.
                </p>
                <div className="landing-specialties__grid">
                    {SPECIALTIES.map((s) => (
                        <SpecialtyCard
                            key={s.iconKey}
                            iconKey={s.iconKey}
                            title={s.title}
                            description={s.description}
                            doctorCount={s.doctorCount}
                        />
                    ))}
                </div>
            </section>

            <section className="landing-section landing-doctors">
                <h2 className="landing-section__title">Танымал дәрігерлер</h2>
                <p className="landing-section__subtitle muted">
                    Тексерілген мамандар — сіздің денсаулығыңыз біздің мақсатымыз.
                </p>
                {doctors.length > 0 ? (
                    <div className="landing-doctors__grid">
                        {doctors.map((d) => (
                            <DoctorCard
                                key={`${d.id}-${d.user_id}`}
                                doctor={d}
                                reviewsData={reviewsByDoctorId[d.id]}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <p className="empty-state__text">Дәрігерлер тізімі жүктелуде немесе әзірге бос.</p>
                        <Link className="btn" to="/doctors">Барлық дәрігерлер</Link>
                    </div>
                )}
                <div className="landing-section__cta">
                    <Link className="btn ghost" to="/doctors">Барлық дәрігерлерді көру</Link>
                </div>
            </section>

            <section className="landing-section landing-appointment">
                <h2 className="landing-section__title">Жазылу формасы</h2>
                <p className="landing-section__subtitle muted">
                    Өзіңізге ыңғайлы уақытты таңдаңыз. Біз сізге хабарласамыз.
                </p>
                <div className="landing-appointment__wrap">
                    <div className="landing-appointment__form-card card">
                        <h3 className="landing-appointment__form-title">Жаңа жазылу</h3>
                        <div className="form">
                            <div className="form-row">
                                <div className="form-field">
                                    <label className="form-label">Аты-жөні</label>
                                    <input type="text" className="input" placeholder="Толық атыңыз" readOnly aria-readonly="true" />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Телефон</label>
                                    <input type="tel" className="input" placeholder="+7 700 000 00 00" readOnly aria-readonly="true" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-field">
                                    <label className="form-label">Қала</label>
                                    <input type="text" className="input" placeholder="Қала" readOnly aria-readonly="true" />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Мамандық</label>
                                    <select className="input" defaultValue="" aria-readonly="true">
                                        <option value="">Таңдаңыз</option>
                                        <option value="therapist">Терапевт</option>
                                        <option value="pediatrician">Педиатр</option>
                                        <option value="cardiologist">Кардиолог</option>
                                        <option value="dentist">Тіс дәрігері</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-field">
                                    <label className="form-label">Күні</label>
                                    <input type="date" className="input" readOnly aria-readonly="true" />
                                </div>
                                <div className="form-field">
                                    <label className="form-label">Уақыты</label>
                                    <input type="time" className="input" readOnly aria-readonly="true" />
                                </div>
                            </div>
                            <div className="form-field">
                                <label className="form-label">Пікір / Ескерту</label>
                                <textarea className="input" rows={3} placeholder="Қосымша ақпарат" readOnly aria-readonly="true" />
                            </div>
                            <Link to="/doctors" className="btn landing-appointment__submit">Жазылуды жалғастыру</Link>
                        </div>
                    </div>
                    <div className="landing-appointment__info card">
                        <h3 className="landing-appointment__info-title">Не үшін Janymda?</h3>
                        <ul className="landing-appointment__info-list">
                            <li>SMS еске салу — жазылу күні сізге еске салады</li>
                            <li>Қауіпсіз деректер — жеке ақпарат қорғалады</li>
                            <li>Онлайн жазылу — уақытты үнемдеңіз, кездесуге дайын келіңіз</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="landing-section landing-testimonials">
                <h2 className="landing-section__title">Пайдаланушылар пікірлері</h2>
                <p className="landing-section__subtitle muted">
                    Нақты пациенттердің тәжірибесі.
                </p>
                {platformFeedbacks.length === 0 ? (
                    <div className="landing-testimonials__empty card">
                        <p className="muted landing-testimonials__empty-text">Әзірге пікірлер жоқ. Алғашқы пікірді сіз қалдырыңыз!</p>
                    </div>
                ) : (
                    <>
                        <div className="landing-testimonials__carousel">
                            <button type="button" className="landing-testimonials__arrow" onClick={prevTestimonial} aria-label="Алдыңғы">
                                ‹
                            </button>
                            <div className="landing-testimonials__track">
                                {platformFeedbacks.map((fb, i) => (
                                    <div
                                        key={fb.id}
                                        className="landing-testimonials__slide"
                                        style={{ display: i === testimonialIndex ? "block" : "none" }}
                                    >
                                        <div className="landing-testimonials__slide-inner">
                                            <TestimonialCard
                                                quote={fb.text}
                                                author={fb.author || ""}
                                                role=""
                                            />
                                            {(fb.is_mine || me?.role === "admin") && (
                                                <button
                                                    type="button"
                                                    className="landing-testimonials__delete-btn btn ghost"
                                                    onClick={() => handleDeleteFeedback(fb.id)}
                                                    aria-label="Пікірді өшіру"
                                                >
                                                    Өшіру
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="landing-testimonials__arrow" onClick={nextTestimonial} aria-label="Келесі">
                                ›
                            </button>
                        </div>
                        <div className="landing-testimonials__dots">
                            {platformFeedbacks.map((_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`landing-testimonials__dot ${i === testimonialIndex ? "is-active" : ""}`}
                                    onClick={() => setTestimonialIndex(i)}
                                    aria-label={`Слайд ${i + 1}`}
                                />
                            ))}
                        </div>
                    </>
                )}

                <div className="landing-testimonials__leave-feedback">
                    {!showFeedbackForm ? (
                        <button
                            type="button"
                            className="btn landing-testimonials__feedback-btn"
                            onClick={() => setShowFeedbackForm(true)}
                        >
                            Пікір қалдыру
                        </button>
                    ) : (
                        <form className="landing-testimonials__form card" onSubmit={handleFeedbackSubmit}>
                            <label className="form-label" htmlFor="platform-feedback">
                                Платформа туралы пікіріңіз
                            </label>
                            {!token() && (
                                <p className="landing-testimonials__login-hint muted">
                                    Пікір жіберу үшін <Link to="/login">жүйеге кіріңіз</Link>.
                                </p>
                            )}
                            <textarea
                                id="platform-feedback"
                                className="input landing-testimonials__textarea"
                                rows={4}
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Пікіріңізді жазыңыз..."
                            />
                            <div className="landing-testimonials__form-actions">
                                <button type="submit" className="btn">
                                    Жіберу
                                </button>
                                <button
                                    type="button"
                                    className="btn ghost"
                                    onClick={() => {
                                        setShowFeedbackForm(false);
                                        setFeedbackText("");
                                        setFeedbackMsg("");
                                    }}
                                >
                                    Болдырмау
                                </button>
                            </div>
                            {feedbackMsg && (
                                <p className={`landing-testimonials__form-msg ${feedbackMsg.includes("Рақмет") ? "is-success" : ""}`}>
                                    {feedbackMsg}
                                </p>
                            )}
                        </form>
                    )}
                </div>
            </section>

            <section className="landing-section landing-faq">
                <h2 className="landing-section__title">Жиі қойылатын сұрақтар</h2>
                <p className="landing-section__subtitle muted">
                    Жазылу және платформа туралы жауаптар.
                </p>
                <div className="landing-faq__list">
                    {FAQ_DATA.map((item, i) => (
                        <FAQItem
                            key={i}
                            question={item.q}
                            answer={item.a}
                            isOpen={faqOpenIndex === i}
                            onToggle={() => setFaqOpenIndex(faqOpenIndex === i ? null : i)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}
