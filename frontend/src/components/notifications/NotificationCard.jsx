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
    const isRead = !!n.read_at;
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

    function visitAction(e) {
        e.stopPropagation();
        if (!isRead) onMarkRead?.(n.id);
    }

    const actionClass = `notif-card__action${isRead ? " notif-card__action--read" : ""}`;

    return (
        <article
            className={`notif-card notif-card--${badge.tone}${isRead ? " notif-card--read" : ""}${
                n.type === "appointment_done" ? " notif-card--done" : ""
            }`}
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
                <Link className={actionClass} to="/profile" onClick={visitAction}>
                    Жазылуларға өту
                </Link>
            ) : null}

            {n.type === "doctor_incomplete_1h" && n.patient_id ? (
                <Link
                    className={actionClass}
                    to={`/doctor/patients/${n.patient_id}`}
                    onClick={visitAction}
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
                                <Link
                                    className={actionClass}
                                    to={`/chat/${n.appointment_id}`}
                                    onClick={visitAction}
                                >
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
                        <Link className={actionClass} to={`/chat/${n.appointment_id}`} onClick={visitAction}>
                            {n.choice === "video" ? "Чат пен видеосілтемесін ашу" : "Чатты ашу"}
                        </Link>
                    ) : null}
                </div>
            ) : null}
        </article>
    );
}
