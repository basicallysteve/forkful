interface Props {
    color?: string
    size?: number
    className?: string
}

export default function EatForkfulIcon({ color = '#10b981', size = 40, className }: Props) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width={size}
            height={size}
            fill="none"
            role="img"
            aria-label="EatForkful logo"
            className={className}
        >
            {/* Light rays — 9 rays at 36° intervals, skipping the straight-down 180° */}
            <g stroke={color} strokeWidth={3.5} strokeLinecap="round">
                <line x1="50"   y1="9"    x2="50"   y2="1"   />
                <line x1="68.2" y1="14.9" x2="72.9" y2="8.4" />
                <line x1="79.5" y1="30.4" x2="87.1" y2="27.9"/>
                <line x1="79.5" y1="49.6" x2="87.1" y2="52.1"/>
                <line x1="68.2" y1="65.1" x2="72.9" y2="71.6"/>
                <line x1="31.8" y1="65.1" x2="27.1" y2="71.6"/>
                <line x1="20.5" y1="49.6" x2="12.9" y2="52.1"/>
                <line x1="20.5" y1="30.4" x2="12.9" y2="27.9"/>
                <line x1="31.8" y1="14.9" x2="27.1" y2="8.4" />
            </g>

            {/* Bulb glass — upper arc + two bezier sides tapering into the neck */}
            <path
                stroke={color}
                strokeWidth={3.5}
                strokeLinejoin="round"
                d="M 25 40 A 25 25 0 0 0 75 40 C 75 52 64 60 62 62 L 38 62 C 36 60 25 52 25 40 Z"
            />

            {/* Base screw — three horizontal bars of decreasing width */}
            <g stroke={color} strokeLinecap="round">
                <line strokeWidth={3.5} x1="38" y1="66" x2="62" y2="66"/>
                <line strokeWidth={3}   x1="39" y1="71" x2="61" y2="71"/>
                <line strokeWidth={3}   x1="41" y1="76" x2="59" y2="76"/>
            </g>

            {/* Fork — 3 tines (matching EatForkful brand), crossbar, stem through the base */}
            <g stroke={color} strokeWidth={3.5} strokeLinecap="round">
                <line x1="41" y1="41" x2="41" y2="25"/>
                <line x1="50" y1="41" x2="50" y2="25"/>
                <line x1="59" y1="41" x2="59" y2="25"/>
                <line x1="41" y1="41" x2="59" y2="41"/>
                <line x1="50" y1="41" x2="50" y2="75"/>
            </g>
        </svg>
    )
}
