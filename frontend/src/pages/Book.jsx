import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

const NO_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>
    <rect width='100%' height='100%' fill='#0b1220'/>
    <circle cx='128' cy='102' r='46' fill='#1f2a44'/>
    <rect x='52' y='160' width='152' height='64' rx='32' fill='#1f2a44'/>
  </svg>`);

function normalizePhoto(url) {
    if (!url) return NO_AVATAR;
    if (url.startsWith("http") || url.startsWith("//")) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
}

export default function Book() {
    const { doctorId } = useParams();
    const nav = useNavigate();
    const [doc, setDoc] = useState(null);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (!token()) {
            nav("/login");
            return;
        }
        api(`/api/v1/doctors/${doctorId}`)
            .then(setDoc)
            .catch((e) => setMsg("Қате: " + e.message));
    }, [doctorId, nav]);

    // Күн өзгергенде бос слоттарды сұрау, уақытты тазалау
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

    // date = "2026-03-03", time = "10:00"
    function toRFC3339(dateStr, timeStr) {
        if (!dateStr || !timeStr) return "";
        const t = timeStr.length === 5 ? timeStr : timeStr.slice(0, 5);
        return `${dateStr}T${t}:00+05:00`;
    }

    async function submit() {
        setMsg("");
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

            nav("/profile");
        } catch (e) {
            setMsg("Қате: " + e.message);
        }
    }

    return (
        <div className="page book-page">
            <div className="book-hero">
                <h1 className="book-hero__title">Дәрігерге жазылу</h1>
                <p className="book-hero__subtitle muted">
                    Күн мен уақытты таңдаңыз, біз сізге жазылуды растаймыз.
                </p>
            </div>

            <div className="book-layout">
                {doc && (
                    <div className="book-doctor-card card">
                        <div className="book-doctor">
                            <div className="book-doctor__photo-wrap">
                                <img
                                    src={normalizePhoto(doc.photo_url)}
                                    alt={doc.full_name}
                                    className="book-doctor__photo"
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = NO_AVATAR;
                                    }}
                                />
                            </div>
                            <div className="book-doctor__info">
                                <p className="book-doctor__label">Дәрігер</p>
                                <h2 className="book-doctor__name">{doc.full_name}</h2>
                                <p className="book-doctor__specialty muted">{doc.specialty}</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="book-form-card card">
                    <h3 className="book-form__title">Күн мен уақытты таңдаңыз</h3>

                    <div className="book-form-row form-row">
                        <div className="form-field">
                            <label className="form-label">Күні</label>
                            <input
                                type="date"
                                className="input book-date-input"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="form-field">
                            <label className="form-label">Уақыты</label>
                            <input
                                type="text"
                                readOnly
                                value={time}
                                placeholder={date ? "Уақытты төменнен таңдаңыз" : "Алдымен күнді таңдаңыз"}
                                className="input book-time-readonly"
                            />
                        </div>

                        <div className="book-form-submit">
                            <button
                                className="btn book-submit-btn"
                                onClick={submit}
                                disabled={!date || !time}
                            >
                                Жазылу
                            </button>
                        </div>
                    </div>

                    {date && (
                        <div className="book-slots-wrap">
                            {slotsLoading ? (
                                <p className="muted book-slots-loading">Жүктелуде...</p>
                            ) : slots.length > 0 ? (
                                <>
                                    <p className="form-label book-slots-label">Бос уақыттар</p>
                                    <div className="book-slots">
                                        {slots.map((slot) => (
                                            <button
                                                key={slot}
                                                type="button"
                                                className={`btn book-slot-btn ${time === slot ? "book-slot-btn--active" : "ghost"}`}
                                                onClick={() => setTime(slot)}
                                            >
                                                {slot}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="muted book-slots-empty">Бұл күні бос уақыт жоқ.</p>
                            )}
                        </div>
                    )}

                    {msg && <p className="form-error book-form-error">{msg}</p>}
                </div>
            </div>
        </div>
    );
}
