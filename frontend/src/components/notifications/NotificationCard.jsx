import { Link } from "react-router-dom";
import MeetingTypeSelector from "./MeetingTypeSelector";
import WaveAccent from "./WaveAccent";
import { badgeIcon } from "./NotificationIcons";
import { fmtDate, getNotificationBadge, notificationBodyText } from "./notificationUtils";

export default function NotificationCard({
    notification: n,
    sending,
    onChoice,
    onMarkRead,
}) {
    const badge = getNotificationBadge(n);
    const showPatientChoice =
        n.type === "5min_choice" && n.patient_choice !== undefined && n.patient_choice !== null;

    const showSelector =
        n.type === "5min_choice" &&
        (n.patient_choice === undefined || n.patient_choice === null) &&
        !n.choice;

    const showChosen =
        n.type === "5min_choice" &&
        (n.patient_choice === undefined || n.patient_choice === null) &&
        !!n.choice;

    return (
        <article
            className={`notif-card notif-card--${badge.tone}${
                n.type === "appointment_done" ? " notif-card--done" : ""
            }`}
            onClick={() => !n.read_at && onMarkRead?.(n.id)}
        >
            <WaveAccent tone={badge.tone} />

            <div className="notif-card__head">
                <span className={`notif-card__badge notif-card__badge--${badge.tone}`}>
                    <span className="notif-card__badge-icon">{badgeIcon(badge.icon)}</span>
                    {badge.text}
                </span>
                <time className="notif-card__date" dateTime={n.created_at}>
                    {fmtDate(n.created_at)}
                </time>
            </div>

            <p className="notif-card__text">{notificationBodyText(n)}</p>

            {n.type === "appointment_done" ? (
                <Link className="notif-card__action" to="/profile" onClick={(e) => e.stopPropagation()}>
                    Жазылуларға өту
                </Link>
            ) : null}

            {n.type === "doctor_incomplete_1h" && n.patient_id ? (
                <Link
                    className="notif-card__action"
                    to={`/doctor/patients/${n.patient_id}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    Жазылуға өту
                </Link>
            ) : null}

            {showPatientChoice ? (
                <div className="notif-card__footer" onClick={(e) => e.stopPropagation()}>
                    {n.patient_choice ? (
                        <>
                            <MeetingTypeSelector value={n.patient_choice} readOnly />
                            {(n.patient_choice === "chat" || n.patient_choice === "video") && n.appointment_id ? (
                                <Link className="notif-card__action" to={`/chat/${n.appointment_id}`}>
                                    {n.patient_choice === "video" ? "Чат пен видеосілтемесін ашу" : "Чатты ашу"}
                                </Link>
                            ) : null}
                        </>
                    ) : (
                        <p className="notif-card__sub muted">Пациент әзірге таңдамады.</p>
                    )}
                </div>
            ) : null}

            {showSelector ? (
                <div className="notif-card__footer" onClick={(e) => e.stopPropagation()}>
                    <MeetingTypeSelector
                        disabled={sending === n.id}
                        onSelect={(choice) => onChoice(n.id, choice)}
                    />
                </div>
            ) : null}

            {showChosen ? (
                <div className="notif-card__footer" onClick={(e) => e.stopPropagation()}>
                    <MeetingTypeSelector value={n.choice} readOnly />
                    {(n.choice === "chat" || n.choice === "video") && n.appointment_id ? (
                        <Link className="notif-card__action" to={`/chat/${n.appointment_id}`}>
                            {n.choice === "video" ? "Чат пен видеосілтемесін ашу" : "Чатты ашу"}
                        </Link>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}
