/**
 * Сервердегі мәндер: pending | approved | done | canceled
 * Жаңа жазылу approved. Дәрігер таңдауында pending жоқ.
 */

export function appointmentStatusLabel(raw, { isPast = false } = {}) {
    const v = (raw || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "Бас тартылды";
    if (v === "done") return "Қабылдау аяқталды";

    if (isPast && (v === "pending" || v === "approved")) return "Уақыты өтті";

    if (v === "pending") return "Күтуде (ескі жазба)";
    if (v === "approved") return "Қабылдау жазылды";
    return raw || "—";
}

/** Дәрігер тізімі / badge */
export function appointmentStatusLabelDoctor(raw) {
    const v = (raw || "").toLowerCase();
    if (v === "canceled" || v === "cancelled") return "Бас тартылды";
    if (v === "pending") return "Күтуде";
    if (v === "approved") return "Қабылдау жазылды";
    if (v === "done") return "Қабылдау аяқталды";
    return raw || "—";
}

/** Дәрігер формасындағы select: тек approved | done */
export const DOCTOR_STATUS_SELECT = [
    {
        value: "approved",
        label: "Қабылдау жазылды",
        hint: "Пациент кездесу уақытын таңдаған; жаңа жазылулар осы күйден басталады.",
    },
    {
        value: "done",
        label: "Қабылдау аяқталды",
        hint: "Кездесу өтті немесе осы жазылу бойынша жұмыс аяқталды.",
    },
];

/** Формада pending болса, select үшін approved көрсетеміз (сақтағанда серверге approved кетеді) */
export function doctorFormStatusFromAppointment(raw) {
    const v = (raw || "").toLowerCase();
    if (v === "done") return "done";
    return "approved";
}

export const APPOINTMENT_STATUS_FLOW_HINT =
    "Пациент уақытты таңдағанда жазылу «Қабылдау жазылды» күйінде болады. Кездесуден кейін «Қабылдау аяқталды» деп белгілеңіз. Бас тартуды пациент өзі жасай алады.";
