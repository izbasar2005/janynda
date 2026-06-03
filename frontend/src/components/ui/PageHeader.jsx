/** Consistent page title block. */
export default function PageHeader({ title, subtitle, actions, className = "" }) {
    return (
        <header className={`page-header ${className}`.trim()}>
            <div className="page-header__main">
                {title && <h1 className="page-header__title">{title}</h1>}
                {subtitle && <p className="muted page-header__subtitle">{subtitle}</p>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </header>
    );
}
