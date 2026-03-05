import { Link } from "react-router-dom";

const icons = {
    therapist: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2C10.9 2 10 2.9 10 4v2H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-4V4c0-1.1-.9-2-2-2h-2zm-1 4h2v2h-2V6zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm4-8h2v2h-2V6zm0 4h2v2h-2v-2z" fill="currentColor" opacity="0.9"/>
        </svg>
    ),
    pediatrician: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2c2.2 0 4 1.8 4 4v1h2c1.1 0 2 .9 2 2v2c0 .55-.22 1.05-.59 1.41L12 16.83 4.59 12.41C4.22 12.05 4 11.55 4 11V9c0-1.1.9-2 2-2h2V6c0-2.2 1.8-4 4-4zm0 2c-1.1 0-2 .9-2 2v1h4V6c0-1.1-.9-2-2-2zm-4 6h2v2H8v-2zm8 0h2v2h-2v-2zm-6 4h4v2h-4v-2z" fill="currentColor" opacity="0.9"/>
        </svg>
    ),
    cardiologist: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" opacity="0.9"/>
        </svg>
    ),
    dentist: (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 2c-.55 0-1 .45-1 1v1H9c-.55 0-1 .45-1 1s.45 1 1 1h2v2H9c-.55 0-1 .45-1 1s.45 1 1 1h2v2H9c-.55 0-1 .45-1 1s.45 1 1 1h2v2c0 .55.45 1 1 1s1-.45 1-1v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-2v-2h2c.55 0 1-.45 1-1s-.45-1-1-1h-2V6h2c.55 0 1-.45 1-1s-.45-1-1-1h-2V3c0-.55-.45-1-1-1z" fill="currentColor" opacity="0.9"/>
        </svg>
    ),
};

export default function SpecialtyCard({ iconKey, title, description, doctorCount, to = "/doctors" }) {
    const icon = icons[iconKey] || icons.therapist;
    return (
        <Link to={to} className="specialty-card card">
            <div className="specialty-card__icon" aria-hidden="true">
                {icon}
            </div>
            <h3 className="specialty-card__title">{title}</h3>
            <p className="specialty-card__desc muted">{description}</p>
            <p className="specialty-card__count muted">
                {doctorCount} дәрігер
            </p>
        </Link>
    );
}
