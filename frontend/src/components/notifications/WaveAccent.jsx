const WAVE_COLORS = {
    blue: "#8b9cf8",
    yellow: "#f5a962",
    green: "#5eead4",
    purple: "#c4b5fd",
    red: "#f87171",
};

export default function WaveAccent({ tone = "blue" }) {
    const color = WAVE_COLORS[tone] || WAVE_COLORS.blue;
    return (
        <svg
            className="notif-card__wave"
            viewBox="0 0 18 240"
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path
                fill={color}
                d="M0 0 C 12 28, 4 56, 12 84 C 4 112, 12 140, 8 168 C 12 196, 4 220, 0 240 L 0 0 Z"
            />
        </svg>
    );
}
