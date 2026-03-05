export default function FAQItem({ question, answer, isOpen, onToggle }) {
    return (
        <div className={`faq-item ${isOpen ? "faq-item--open" : ""}`}>
            <button
                type="button"
                className="faq-item__trigger"
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                <span>{question}</span>
                <span className="faq-item__icon" aria-hidden="true">+</span>
            </button>
            <div className="faq-item__content" hidden={!isOpen}>
                <p className="faq-item__answer muted">{answer}</p>
            </div>
        </div>
    );
}
