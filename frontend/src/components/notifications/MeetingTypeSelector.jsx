import { IconChat, IconUsers, IconVideo } from "./NotificationIcons";
import { choiceLabel } from "./notificationUtils";

const OPTIONS = [
    { value: "in_person", label: "Жүзбе-жүз", Icon: IconUsers, tone: "blue" },
    { value: "video", label: "Видео", Icon: IconVideo, tone: "green" },
    { value: "chat", label: "Чат арқылы", Icon: IconChat, tone: "purple" },
];

export default function MeetingTypeSelector({ value, onSelect, disabled, readOnly = false }) {
    const interactive = !readOnly && typeof onSelect === "function";

    return (
        <div className="notif-meeting notif-meeting--inline">
            {value ? (
                <p className="notif-meeting__chosen">
                    Таңдауыңыз: <strong>{choiceLabel(value)}</strong>
                </p>
            ) : (
                <p className="notif-meeting__hint">Кездесу тәсілін таңдаңыз</p>
            )}
            <div className="notif-meeting__icons" role={interactive ? "group" : undefined} aria-label="Кездесу тәсілі">
                {OPTIONS.map(({ value: v, label, Icon, tone }) => {
                    const active = value === v;
                    const cls = `notif-meeting__icon-btn notif-meeting__icon-btn--${tone}${active ? " is-active" : ""}`;

                    if (interactive) {
                        return (
                            <button
                                key={v}
                                type="button"
                                className={cls}
                                onClick={() => onSelect(v)}
                                disabled={disabled}
                                aria-pressed={active}
                                aria-label={label}
                                title={label}
                            >
                                <Icon />
                            </button>
                        );
                    }

                    return (
                        <span key={v} className={cls} title={label} aria-hidden={!active}>
                            <Icon />
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
