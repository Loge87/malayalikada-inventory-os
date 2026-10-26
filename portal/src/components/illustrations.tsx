/* Sleek, modern UI-style SVG illustrations for the home page's value cards:
   soft glass cards, thin lines, gradient accents. Colours come from the
   portal's CSS variables so they follow the theme. */

const g = "var(--brand)";
const a = "var(--accent)";
const tint = "color-mix(in oklab, var(--brand) 10%, white)";
const tint2 = "color-mix(in oklab, var(--brand) 22%, white)";
const line = "color-mix(in oklab, var(--brand) 16%, #dfe6e2)";
const ink = "#0f1a14";
const FONT = "ui-sans-serif, system-ui, sans-serif";

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
        <stop offset="0" stopColor={g} stopOpacity="0.16" />
        <stop offset="1" stopColor={g} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-brand`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={g} stopOpacity="0.85" />
        <stop offset="1" stopColor={g} />
      </linearGradient>
      <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={a} stopOpacity="0.8" />
        <stop offset="1" stopColor={a} />
      </linearGradient>
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor={ink} floodOpacity="0.12" />
      </filter>
    </defs>
  );
}

/** A retailer profile card with an "Approved" badge — "approved retailers only". */
export function ApprovedStoreIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A retailer profile card with an approved badge">
      <Defs id="ap" />
      <ellipse cx="110" cy="70" rx="104" ry="68" fill="url(#ap-glow)" />
      {/* back card */}
      <rect x="44" y="26" width="132" height="92" rx="14" fill="#fff" stroke={line} opacity="0.7" transform="rotate(-6 110 72)" />
      {/* front card */}
      <g filter="url(#ap-shadow)">
        <rect x="34" y="34" width="152" height="94" rx="14" fill="#fff" stroke={line} />
      </g>
      {/* avatar */}
      <circle cx="62" cy="64" r="15" fill="url(#ap-brand)" />
      <path d="M54 63 l2.5 -6 h11 l2.5 6 v1.5 h-16 Z M55 66 v7 h14 v-7" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="84" y="55" width="60" height="7" rx="3.5" fill={ink} opacity="0.82" />
      <rect x="84" y="68" width="38" height="5" rx="2.5" fill={ink} opacity="0.2" />
      {/* rows */}
      <rect x="48" y="92" width="124" height="1" fill={line} />
      <rect x="48" y="102" width="70" height="5" rx="2.5" fill={ink} opacity="0.14" />
      <rect x="48" y="112" width="46" height="5" rx="2.5" fill={ink} opacity="0.1" />
      {/* approved pill */}
      <g className="anim-float">
        <g filter="url(#ap-shadow)">
          <rect x="116" y="96" width="82" height="28" rx="14" fill="url(#ap-accent)" />
        </g>
        <circle cx="132" cy="110" r="8" fill="#fff" fillOpacity="0.22" />
        <path d="M128.2 110.2 l3 3 l5.6 -6.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="168" y="113.5" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff" fontFamily={FONT} letterSpacing="0.2">Approved</text>
      </g>
    </svg>
  );
}

/** An isometric case with a per-case price chip — "priced by the case". */
export function CasePriceIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A case of products with a price per case">
      <Defs id="cp" />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#cp-glow)" />
      {/* isometric case */}
      <g className="anim-float" filter="url(#cp-shadow)">
        <path d="M78 54 L110 38 L142 54 L110 70 Z" fill={tint2} stroke={g} strokeOpacity="0.5" strokeLinejoin="round" />
        <path d="M78 54 L110 70 V108 L78 92 Z" fill="url(#cp-brand)" />
        <path d="M142 54 L110 70 V108 L142 92 Z" fill={g} />
        <path d="M142 54 L110 70 V108 L142 92 Z" fill="#000" opacity="0.14" />
        {/* tape */}
        <path d="M94 46 L126 62" stroke="#fff" strokeOpacity="0.75" strokeWidth="5" strokeLinecap="round" />
        {/* label */}
        <path d="M86 78 l16 8 v10 l-16 -8 Z" fill="#fff" fillOpacity="0.9" />
        <path d="M89.5 82.5 l9 4.5 M89.5 88 l6 3" stroke={g} strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* ground shadow */}
      <ellipse cx="110" cy="116" rx="40" ry="6" fill={ink} opacity="0.08" />
      {/* price chip */}
      <g filter="url(#cp-shadow)">
        <rect x="124" y="14" width="86" height="36" rx="12" fill="#fff" stroke={line} />
      </g>
      <text x="136" y="30" fontSize="8" fontWeight="600" fill={ink} opacity="0.5" fontFamily={FONT} letterSpacing="0.6">TRADE PRICE</text>
      <text x="136" y="43.5" fontSize="13.5" fontWeight="800" fill={ink} fontFamily={FONT}>$48.00</text>
      <rect x="176" y="33" width="28" height="12" rx="6" fill={tint} />
      <text x="190" y="42" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={g} fontFamily={FONT}>/ case</text>
      {/* qty stepper */}
      <g filter="url(#cp-shadow)">
        <rect x="12" y="92" width="72" height="28" rx="14" fill="#fff" stroke={line} />
      </g>
      <circle cx="27" cy="106" r="8" fill={tint} />
      <path d="M23.5 106 h7" stroke={g} strokeWidth="2" strokeLinecap="round" />
      <text x="48" y="110" textAnchor="middle" fontSize="11" fontWeight="800" fill={ink} fontFamily={FONT}>12</text>
      <circle cx="69" cy="106" r="8" fill="url(#cp-brand)" />
      <path d="M65.5 106 h7 M69 102.5 v7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A stock panel with progress rows and a live indicator — "live stock". */
export function LiveStockIllustration() {
  const rows = [
    { y: 56, w: 92, label: "In stock", ok: true },
    { y: 80, w: 58, label: "In stock", ok: true },
    { y: 104, w: 18, label: "Low", ok: false },
  ];
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A live stock panel with availability bars">
      <Defs id="ls" />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#ls-glow)" />
      <g filter="url(#ls-shadow)">
        <rect x="24" y="22" width="172" height="110" rx="16" fill="#fff" stroke={line} />
      </g>
      {/* header */}
      <rect x="40" y="35" width="52" height="6" rx="3" fill={ink} opacity="0.8" />
      <g>
        <rect x="140" y="30" width="44" height="16" rx="8" fill={tint} />
        <circle cx="151" cy="38" r="7" fill={a} opacity="0.28" className="anim-ping" />
        <circle cx="151" cy="38" r="3" fill={a} />
        <text x="168" y="41.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={g} fontFamily={FONT} letterSpacing="0.6">LIVE</text>
      </g>
      <rect x="40" y="50.5" width="144" height="1" fill={line} opacity="0" />
      {/* rows */}
      {rows.map((r) => (
        <g key={r.y}>
          <rect x="40" y={r.y - 6} width="14" height="14" rx="4" fill={r.ok ? tint : "color-mix(in oklab, var(--accent) 16%, white)"} />
          <rect x="62" y={r.y - 5} width="38" height="4.5" rx="2.25" fill={ink} opacity="0.16" />
          <rect x="62" y={r.y + 3} width="100" height="5" rx="2.5" fill={tint} />
          <rect x="62" y={r.y + 3} width={r.w} height="5" rx="2.5" fill={r.ok ? "url(#ls-brand)" : "url(#ls-accent)"} />
          <circle cx="178" cy={r.y + 0.5} r="5.5" fill={r.ok ? g : a} />
          {r.ok ? (
            <path d={`M175.3 ${r.y + 0.5} l2 2 l3.6 -4`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={`M178 ${r.y - 2.5} v3.4 M178 ${r.y + 3.2} v0.2`} stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </g>
      ))}
    </svg>
  );
}
