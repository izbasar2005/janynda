export default function TestimonialCard({ quote, author, role }) {
    return (
        <div className="testimonial-card card">
            <blockquote className="testimonial-card__quote">"{quote}"</blockquote>
            <footer className="testimonial-card__author">
                <strong>{author}</strong>
                {role && <span className="muted"> — {role}</span>}
            </footer>
        </div>
    );
}
