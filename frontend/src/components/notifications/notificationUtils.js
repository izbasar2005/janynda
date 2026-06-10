export function fmtDate(d) {
    if (!d) return "";
    try {
        const dt = new Date(d);
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const day = String(dt.getDate()).padStart(2, "0");
        const h = String(dt.getHours()).padStart(2, "0");
        const min = String(dt.getMinutes()).padStart(2, "0");
        return `${y}-${m}-${day} ${h}:${min}`;
    } catch {
        return String(d);
    }
}

function choiceTone(choice) {
    switch (choice) {
        case "in_person":
            return "blue";
        case "video":
            return "green";
        case "chat":
            return "purple";
        default:
            return "blue";
    }
}

/** Screenshot palette only: blue, yellow, green, purple — no red states */
export function getNotificationTone(n) {
    if (n.type === "5min_choice") {
        const picked = n.choice || n.patient_choice;
        return picked ? choiceTone(picked) : "blue";
    }
    if (n.type === "15min_reminder") return "yellow";
    if (n.type === "appointment_done") return "green";
    if (n.type === "doctor_incomplete_1h") return "yellow";
    if (n.type === "role_change") return "blue";
    return "blue";
}

export function getNotificationBadge(n) {
    const tone = getNotificationTone(n);

    if (n.type === "5min_choice") {
        return { tone, text: "5 мин — таңдау", icon: "choice" };
    }
    if (n.type === "15min_reminder") {
        return { tone: "yellow", text: "15 мин қалды", icon: "reminder" };
    }
    if (n.type === "appointment_done") {
        return { tone: "green", text: "Қабылдау аяқталды", icon: "confirmed" };
    }
    if (n.type === "doctor_incomplete_1h") {
        return { tone: "yellow", text: "Жазылуды аяқтаңыз", icon: "reminder" };
    }
    if (n.type === "role_change") {
        return { tone: "blue", text: "Аккаунт", icon: "choice" };
    }
    return { tone, text: "Хабарлама", icon: "choice" };
}

export function notificationBodyText(n) {
    switch (n.type) {
        case "15min_reminder":
            return `Сіздің жазылымыңыз бар: ${n.doctor_name || "Дәрігер"} — ${fmtDate(n.start_at)}. Ұмытпаңыз.`;
        case "5min_choice":
            return n.patient_choice !== undefined && n.patient_choice !== null
                ? "Кездесу жақындады. Пациенттің таңдауы төменде."
                : "Кездесу жақындады. Қалай сөйлескіңіз келеді?";
        case "doctor_incomplete_1h":
            return (
                n.message ||
                "Толтырылмаған жазылымыңыз бар: «Қабылдау аяқталды» күйін қойып, диагноз/жазбаны тексеріңіз."
            );
        case "appointment_done":
            return (
                n.message ||
                "Қабылдау аяқталды. Диагноз бен дәрігер жазбасын «Менің профилім» → жазылулардан қараңыз."
            );
        case "role_change":
            return n.message || "Аккаунт рөлі жаңартылды.";
        default:
            return n.message || "Қосымша мәлімет көрсетілмеген.";
    }
}

export function choiceLabel(choice) {
    switch (choice) {
        case "in_person":
            return "Жүзбе-жүз";
        case "video":
            return "Видео";
        case "chat":
            return "Чат арқылы";
        default:
            return choice || "";
    }
}
