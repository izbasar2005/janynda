/** Scrollable table container with mobile overflow handling. */
export default function TableWrap({ children, className = "", scrollHint = true }) {
    const cls = ["table-wrap", scrollHint && "table-wrap--scroll-hint", className]
        .filter(Boolean)
        .join(" ");
    return <div className={cls}>{children}</div>;
}
