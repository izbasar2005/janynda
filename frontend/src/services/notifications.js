import { api, token } from "./api";

export const NOTIFICATIONS_UPDATED = "notifications:updated";

export function dispatchNotificationsUpdated() {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED));
}

async function markNotifications(list) {
    if (!list.length) return;
    await Promise.all(
        list.map((n) => api(`/api/v1/notifications/${n.id}/read`, { method: "POST", auth: true }))
    );
    dispatchNotificationsUpdated();
}

async function fetchUnreadNotifications() {
    if (!token()) return [];
    const data = await api("/api/v1/notifications", { auth: true });
    const list = Array.isArray(data) ? data : [];
    return list.filter((n) => !n.read_at);
}

export async function markNotificationRead(id) {
    if (!id || !token()) return;
    await api(`/api/v1/notifications/${id}/read`, { method: "POST", auth: true });
    dispatchNotificationsUpdated();
}

export async function markUnreadNotificationsForAppointment(appointmentId) {
    if (!appointmentId || !token()) return;
    try {
        const unread = await fetchUnreadNotifications();
        const matching = unread.filter((n) => Number(n.appointment_id) === Number(appointmentId));
        await markNotifications(matching);
    } catch {
        // ignore
    }
}

export async function markUnreadNotificationsForPatient(patientId) {
    if (!patientId || !token()) return;
    try {
        const unread = await fetchUnreadNotifications();
        const matching = unread.filter(
            (n) => n.type === "doctor_incomplete_1h" && Number(n.patient_id) === Number(patientId)
        );
        await markNotifications(matching);
    } catch {
        // ignore
    }
}

export async function markUnreadAppointmentDoneNotifications() {
    if (!token()) return;
    try {
        const unread = await fetchUnreadNotifications();
        const matching = unread.filter((n) => n.type === "appointment_done");
        await markNotifications(matching);
    } catch {
        // ignore
    }
}

/** Батырмасыз хабарламалар — ескертулер бетіне кіргенде оқылған деп белгіленеді */
const PAGE_VIEW_READ_TYPES = new Set(["15min_reminder", "role_change"]);

export async function markUnreadPageViewNotifications() {
    if (!token()) return;
    try {
        const unread = await fetchUnreadNotifications();
        const matching = unread.filter((n) => PAGE_VIEW_READ_TYPES.has(n.type));
        await markNotifications(matching);
    } catch {
        // ignore
    }
}
