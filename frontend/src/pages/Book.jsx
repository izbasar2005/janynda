import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

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
        <div className="page">
            <div className="page-header">
                <div>
                    <h2 className="page-header__title">Дәрігерге жазылу</h2>
                    <p className="muted page-header__subtitle">
                        Күн мен уақытты таңдаңыз, біз сізге жазылуды растаймыз.
                    </p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 900 }}>
                {doc && (
                    <p className="muted" style={{ marginTop: 0 }}>
                        Дәрігер: <b>{doc.full_name}</b> — {doc.specialty}
                    </p>
                )}

                <div className="form-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
                    <div className="form-field">
                        <label className="form-label">Күні</label>
                        <input
                            type="date"
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
                            className="book-time-readonly"
                        />
                    </div>

                    <button className="btn" onClick={submit} disabled={!date || !time}>
                        Жазылу
                    </button>
                </div>

                {date && (
                    <div className="book-slots-wrap" style={{ marginTop: 14 }}>
                        {slotsLoading ? (
                            <p className="muted" style={{ margin: 0 }}>Жүктелуде...</p>
                        ) : slots.length > 0 ? (
                            <>
                                <p className="form-label" style={{ marginBottom: 8 }}>Бос уақыттар</p>
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
                            <p className="muted" style={{ margin: 0 }}>Бұл күні бос уақыт жоқ.</p>
                        )}
                    </div>
                )}

                {msg && <p className="form-error" style={{ marginTop: 10 }}>{msg}</p>}
            </div>
        </div>
    );
}
