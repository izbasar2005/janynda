import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
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

const TESTIMONIALS = [
    { quote: "Жазылу өте оңай болды. Дәрігерге тез жетімді болдым.", author: "Айгүл М.", role: "Пациент" },
    { quote: "Платформа ыңғайлы. Уақытты үнемдедім.", author: "Дархан К.", role: "Пациент" },
    { quote: "Қауіпсіз және сенімді сервис. Ұсынамын.", author: "Мадина С.", role: "Пациент" },
];

const FAQ_DATA = [
    { q: "Онлайн жазылу қалай жұмыс істейді?", a: "Сіз дәрігерді таңдап, күн мен уақытты белгілейсіз. Растау SMS арқылы келеді. Тіркелу үшін платформада тіркелу керек." },
    { q: "Жазылуды болдырмауға бола ма?", a: "Иә. Жазылуды кейінге қалдыру немесе болдырмау мүмкіндігі бар. Профиль бөлімінде өз жазылуларыңызды басқара аласыз." },
    { q: "Деректерім қауіпсіз бе?", a: "Иә. Барлық деректер шифрланған байланыс арқылы өтеді. Жеке ақпаратты сақтау саясатымызға сәйкес қорғалады." },
    { q: "Төлем қалай жүзеге асырылады?", a: "Қазіргі кезде төлем кездесу кезінде дәрігерге төленеді. Онлайн төлем болашақта қосылады." },
];

export default function Home() {
    const [doctors, setDoctors] = useState([]);
    const [testimonialIndex, setTestimonialIndex] = useState(0);
    const [faqOpenIndex, setFaqOpenIndex] = useState(null);

    useEffect(() => {
        api("/api/v1/doctors")
            .then((d) => {
                const arr = Array.isArray(d) ? d : [];
                setDoctors(arr.slice(0, 6));
            })
            .catch(() => setDoctors([]));
    }, []);

    const nextTestimonial = () => setTestimonialIndex((i) => (i + 1) % TESTIMONIALS.length);
    const prevTestimonial = () => setTestimonialIndex((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);

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
                            <DoctorCard key={`${d.id}-${d.user_id}`} doctor={d} />
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
                <div className="landing-testimonials__carousel">
                    <button type="button" className="landing-testimonials__arrow" onClick={prevTestimonial} aria-label="Алдыңғы">
                        ‹
                    </button>
                    <div className="landing-testimonials__track">
                        {TESTIMONIALS.map((t, i) => (
                            <div
                                key={i}
                                className="landing-testimonials__slide"
                                style={{ display: i === testimonialIndex ? "block" : "none" }}
                            >
                                <TestimonialCard quote={t.quote} author={t.author} role={t.role} />
                            </div>
                        ))}
                    </div>
                    <button type="button" className="landing-testimonials__arrow" onClick={nextTestimonial} aria-label="Келесі">
                        ›
                    </button>
                </div>
                <div className="landing-testimonials__dots">
                    {TESTIMONIALS.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`landing-testimonials__dot ${i === testimonialIndex ? "is-active" : ""}`}
                            onClick={() => setTestimonialIndex(i)}
                            aria-label={`Слайд ${i + 1}`}
                        />
                    ))}
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
