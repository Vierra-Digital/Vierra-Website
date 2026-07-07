// A plane flying a route on its own — banking along the path, scaling for depth,
// with a moving shadow, drifting clouds, and a slight perspective tilt for a 3D
// feel. Pure SVG + SMIL, self-contained (no libraries, no external assets).
export default function AutopilotPlane() {
  return (
    <div className="relative mx-auto w-full max-w-lg [perspective:1200px]">
      <div className="[transform:rotateX(14deg)]">
        <svg
          viewBox="0 0 460 320"
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label="A plane flying on autopilot"
        >
          <defs>
            <linearGradient id="ap-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F3ECFF" />
              <stop offset="55%" stopColor="#B98CF0" />
              <stop offset="100%" stopColor="#6B21C7" />
            </linearGradient>
            <linearGradient id="ap-route" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#701CC0" stopOpacity="0" />
              <stop offset="50%" stopColor="#B366FF" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#701CC0" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="ap-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#701CC0" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#701CC0" stopOpacity="0" />
            </radialGradient>
            <filter id="ap-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>

          {/* ambient glow */}
          <ellipse cx="230" cy="165" rx="185" ry="120" fill="url(#ap-glow)" />

          {/* drifting clouds (parallax depth) */}
          <g fill="#C99DFF" opacity="0.13" filter="url(#ap-soft)">
            <ellipse cx="95" cy="80" rx="46" ry="15">
              <animate attributeName="cx" values="95;128;95" dur="9s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx="340" cy="235" rx="62" ry="19">
              <animate attributeName="cx" values="340;308;340" dur="12s" repeatCount="indefinite" />
            </ellipse>
          </g>

          {/* flight route — dashes flow forward */}
          <path
            id="ap-route-path"
            d="M30,255 C130,255 140,75 230,75 C320,75 330,245 430,150"
            fill="none"
            stroke="url(#ap-route)"
            strokeWidth="2.5"
            strokeDasharray="5 10"
            strokeLinecap="round"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="0.9s" repeatCount="indefinite" />
          </path>

          {/* destination marker */}
          <circle cx="430" cy="150" r="6" fill="none" stroke="#C99DFF" strokeWidth="2">
            <animate attributeName="r" values="6;12;6" dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="430" cy="150" r="3" fill="#C99DFF" />

          {/* moving shadow beneath the plane (depth) */}
          <g>
            <ellipse cx="0" cy="22" rx="15" ry="4" fill="#050208" opacity="0.28" filter="url(#ap-soft)" />
            <animateMotion dur="7s" repeatCount="indefinite" calcMode="linear">
              <mpath href="#ap-route-path" />
            </animateMotion>
          </g>

          {/* the plane — banks along the path (rotate) + pulses in scale (depth) */}
          <g>
            <g>
              <g transform="translate(-16 -11)">
                <path d="M0,4 L32,11 L0,18 L7,11 Z" fill="url(#ap-body)" />
                <path d="M0,4 L32,11 L7,11 Z" fill="#F3ECFF" opacity="0.6" />
                <path d="M7,11 L0,18 L0,4 Z" fill="#4C1690" opacity="0.55" />
              </g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values="0.82;1.15;0.82"
                dur="7s"
                repeatCount="indefinite"
                calcMode="spline"
                keyTimes="0;0.5;1"
                keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
              />
            </g>
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto" calcMode="linear">
              <mpath href="#ap-route-path" />
            </animateMotion>
          </g>
        </svg>
      </div>
    </div>
  )
}
