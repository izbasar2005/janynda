function getInitials(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "П";
    const a = (parts[0][0] || "П").toUpperCase();
    const b = (parts[1]?.[0] || parts[0][1] || "").toUpperCase();
    return (a + b).slice(0, 2);
}

function StarRow({ rating = 5 }) {
    return (
        <div className="tcard__stars" aria-label={`${rating} из 5`}>
            {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`tcard__star${i < rating ? " is-filled" : ""}`} aria-hidden>
                    ★
                </span>
            ))}
        </div>
    );
}

export default function TestimonialCard({
    quote,
    author,
    city = "Қазақстан",
    dateLabel = "",
    rating = 5,
    footerLabel = "",
    onDelete,
    showDelete = false,
}) {
    const displayAuthor = (author || "").trim() || "Пациент";

    return (
        <article className="tcard">
            {showDelete && onDelete ? (
                <button type="button" className="tcard__delete" onClick={onDelete} aria-label="Пікірді өшіру">
                    Өшіру
                </button>
            ) : null}

            <header className="tcard__head">
                <div className="tcard__avatar" aria-hidden>
                    {getInitials(displayAuthor)}
                </div>
                <div className="tcard__identity">
                    <div className="tcard__name">{displayAuthor}</div>
                    <div className="tcard__city">{city}</div>
                </div>
            </header>

            <StarRow rating={rating} />

            <blockquote className="tcard__quote">{quote}</blockquote>

            <footer className="tcard__footer">
                {footerLabel || dateLabel || "Расталған пікір"}
            </footer>
        </article>
    );
}
