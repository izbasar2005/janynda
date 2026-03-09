import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, token } from "../services/api";

function fmtDate(d) {
    if (!d) return "";
    try {
        return new Date(d).toLocaleString("kk-KZ", { dateStyle: "short", timeStyle: "short" });
    } catch {
        return String(d);
    }
}

export default function Notifications() {
    const nav = useNavigate();
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(null);

    useEffect(() => {
        if (!token()) {
            nav("/login");
            return;
        }
        api("/api/v1/notifications", { auth: true })
            .then((data) => {
                const arr = Array.isArray(data) ? data : [];
                setList(arr);
                arr.filter((n) => !n.read_at).forEach((n) => {
                    api(`/api/v1/notifications/${n.id}/read`, { method: "POST", auth: true }).catch(() => {});
                });
            })
            .catch(() => setList([]))
            .finally(() => setLoading(false));
    }, [nav]);

    async function setChoice(notifId, choice) {
        setSending(notifId);
        try {
            await api(`/api/v1/notifications/${notifId}/choice`, {
                method: "POST",
                auth: true,
                body: { choice },
            });
            setList((prev) => prev.map((n) => (n.id === notifId ? { ...n, choice } : n)));
            if (choice === "chat" || choice === "video") {
                const appId = list.find((x) => x.id === notifId)?.appointment_id;
                if (appId) nav(`/chat/${appId}`);
            }
        } catch (e) {
            alert(e.message || "Қате");
        } finally {
            setSending(null);
        }
    }

    if (loading) {
        return (
            <div className="page">
                <p className="muted">Жүктелуде...</p>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-header">
                <h2 className="page-header__title">Хабарламалар</h2>
                <p className="muted page-header__subtitle">
                    Жазылу туралы еске салулар және кездесу тәсілін таңдау.
                </p>
            </div>

            {list.length === 0 ? (
                <div className="card" style={{ padding: 24 }}>
                    <p className="muted">Ескертулер әзірге жоқ.</p>
                </div>
            ) : (
                <ul className="notif-list">
                    {list.map((n) => (
                        <li key={n.id} className={`card notif-card ${n.read_at ? "notif-card--read" : ""}`}>
                            <div className="notif-card__head">
                                <span className="notif-card__type">
                                    {n.type === "15min_reminder"
                                        ? "⏰ 15 мин қалды"
                                        : n.type === "5min_choice"
                                        ? "📋 5 мин — таңдау"
                                        : "ℹ️ Рөл өзгерісі"}
                                </span>
                                <span className="muted notif-card__date">{fmtDate(n.created_at)}</span>
                            </div>
                            <p className="notif-card__text">
                                {n.type === "15min_reminder"
                                    ? `Сіздің жазылымыңыз бар: ${n.doctor_name || "Дәрігер"} — ${fmtDate(n.start_at)}. Ұмытпаңыз.`
                                    : n.type === "5min_choice"
                                    ? n.patient_choice !== undefined
                                        ? "Кездесу жақындады. Пациенттің таңдауы төменде."
                                        : "Кездесу жақындады. Қалай сөйлескіңіз келеді?"
                                    : n.message || "Сіздің рөліңіз өзгертілді."}
                            </p>
                            {n.type === "5min_choice" && n.patient_choice !== undefined && n.patient_choice !== null && (
                                <>
                                <p className="notif-card__patient-choice">
                                    {n.patient_choice ? (
                                        <>
                                            <strong>Пациент таңдады:</strong>{" "}
                                            {n.patient_choice === "in_person" ? "Жүзбе-жүз кездесу" : n.patient_choice === "chat" ? "Чат арқылы" : "Видео консультация"}
                                        </>
                                    ) : (
                                        <span className="muted">Пациент әзірге таңдамады.</span>
                                    )}
                                </p>
                                {(n.patient_choice === "chat" || n.patient_choice === "video") && n.appointment_id && (
                                    <Link
                                        to={`/chat/${n.appointment_id}`}
                                        className="btn notif-card__action-btn"
                                    >
                                        {n.patient_choice === "video" ? "Чат пен видеосілтемесін ашу" : "Чатты ашу"}
                                    </Link>
                                )}
                                </>
                            )}
                            {n.type === "5min_choice" && (n.patient_choice === undefined || n.patient_choice === null) && !n.choice && (
                                <div className="notif-card__choices">
                                    <button
                                        type="button"
                                        className="btn ghost notif-choice-btn"
                                        onClick={() => setChoice(n.id, "in_person")}
                                        disabled={sending === n.id}
                                    >
                                        Жүзбе-жүз кездесу
                                    </button>
                                    <button
                                        type="button"
                                        className="btn notif-choice-btn"
                                        onClick={() => setChoice(n.id, "chat")}
                                        disabled={sending === n.id}
                                    >
                                        Чат арқылы
                                    </button>
                                    <button
                                        type="button"
                                        className="btn notif-choice-btn"
                                        onClick={() => setChoice(n.id, "video")}
                                        disabled={sending === n.id}
                                    >
                                        Видео консультация
                                    </button>
                                </div>
                            )}
                            {n.type === "5min_choice" && (n.patient_choice === undefined || n.patient_choice === null) && n.choice && (
                                <>
                                <p className="muted notif-card__chosen">
                                    Таңдауыңыз:{" "}
                                    {n.choice === "in_person"
                                        ? "Жүзбе-жүз"
                                        : n.choice === "chat"
                                        ? "Чат"
                                        : "Видео"}
                                </p>
                                {(n.choice === "chat" || n.choice === "video") && n.appointment_id && (
                                    <Link
                                        to={`/chat/${n.appointment_id}`}
                                        className="btn notif-card__action-btn"
                                    >
                                        {n.choice === "video" ? "Чат пен видеосілтемесін ашу" : "Чатты ашу"}
                                    </Link>
                                )}
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
