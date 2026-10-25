/* Small, self-contained SVG illustrations for the home page's value cards.
   Colours come from the portal's CSS variables so they follow the theme. */

const g = "var(--brand)";
const gl = "color-mix(in oklab, var(--brand) 14%, white)";
const gm = "color-mix(in oklab, var(--brand) 32%, white)";
const a = "var(--accent)";
const al = "color-mix(in oklab, var(--accent) 22%, white)";

/** A shop front with an approval shield — "approved retailers only". */
export function ApprovedStoreIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A shop front with an approved badge">
      <ellipse cx="108" cy="136" rx="78" ry="7" fill="#0f1a14" opacity="0.07" />
      {/* building */}
      <rect x="40" y="62" width="136" height="70" rx="6" fill="#fff" stroke={gm} strokeWidth="2" />
      {/* awning */}
      <path d="M32 62 L44 32 H172 L184 62 Z" fill={g} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M${32 + i * 25.3} 62 L${44 + i * 21.3} 32 H${44 + (i + 1) * 21.3} L${32 + (i + 1) * 25.3} 62 Z`}
          fill={i % 2 === 0 ? g : "#fff"}
          opacity={i % 2 === 0 ? 1 : 0.92}
        />
      ))}
      <path d="M32 62 q12.65 12 25.3 0 q12.65 12 25.3 0 q12.65 12 25.3 0 q12.65 12 25.3 0 q12.65 12 25.3 0 q12.65 12 25.3 0" fill="none" stroke={g} strokeWidth="3" />
      {/* door + window */}
      <rect x="58" y="88" width="34" height="44" rx="4" fill={gl} stroke={gm} strokeWidth="2" />
      <circle cx="85" cy="112" r="2.5" fill={g} />
      <rect x="108" y="88" width="52" height="30" rx="4" fill={al} stroke={a} strokeWidth="2" opacity="0.9" />
      <path d="M116 110 l9 -9 l8 6 l11 -11" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* shield badge */}
      <g className="anim-float">
        <path d="M168 18 l26 8 v22 c0 15 -11 26 -26 32 c-15 -6 -26 -17 -26 -32 V26 Z" fill={a} />
        <path d="M168 18 l26 8 v22 c0 15 -11 26 -26 32 Z" fill="#000" opacity="0.07" />
        <path d="M157 48 l8 8 l15 -16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Stacked cases with a price tag — "priced by the case". */
export function CasePriceIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="Stacked cases with a price tag">
      <ellipse cx="104" cy="136" rx="82" ry="7" fill="#0f1a14" opacity="0.07" />
      {/* bottom row */}
      {[28, 94].map((x) => (
        <g key={x}>
          <rect x={x} y="88" width="60" height="44" rx="4" fill={gl} stroke={g} strokeWidth="2.5" />
          <rect x={x + 22} y="88" width="16" height="44" fill={gm} opacity="0.8" />
          <path d={`M${x + 8} 104 h10 M${x + 8} 112 h7`} stroke={g} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        </g>
      ))}
      {/* top case */}
      <g className="anim-float">
        <rect x="60" y="42" width="64" height="46" rx="4" fill="#fff" stroke={g} strokeWidth="2.5" />
        <rect x="84" y="42" width="16" height="46" fill={gm} opacity="0.8" />
        <path d="M68 62 h10 M68 70 h7" stroke={g} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </g>
      {/* price tag */}
      <g transform="rotate(10 168 62)">
        <path d="M140 34 h42 q6 0 6 6 v44 q0 6 -6 6 h-42 q-6 0 -6 -6 V40 q0 -6 6 -6 Z" fill={a} />
        <circle cx="146" cy="44" r="3.5" fill="#fff" />
        <text x="161" y="66" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff" fontFamily="ui-sans-serif, system-ui, sans-serif">$</text>
        <text x="161" y="82" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff" fontFamily="ui-sans-serif, system-ui, sans-serif" opacity="0.95">per case</text>
      </g>
    </svg>
  );
}

/** Rising stock bars with a live pulse — "live stock". */
export function LiveStockIllustration() {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="Stock level bars with a live indicator">
      <ellipse cx="108" cy="136" rx="82" ry="7" fill="#0f1a14" opacity="0.07" />
      <rect x="22" y="20" width="168" height="108" rx="14" fill="#fff" stroke={gm} strokeWidth="2" />
      {/* grid */}
      {[52, 78, 104].map((y) => (
        <path key={y} d={`M36 ${y} H176`} stroke={gm} strokeWidth="1.5" strokeDasharray="3 5" opacity="0.7" />
      ))}
      {/* bars */}
      {[
        { x: 42, h: 36, c: gm },
        { x: 76, h: 56, c: gm },
        { x: 110, h: 44, c: gm },
        { x: 144, h: 70, c: g },
      ].map((b) => (
        <rect key={b.x} x={b.x} y={118 - b.h} width="22" height={b.h} rx="5" fill={b.c} />
      ))}
      {/* live badge */}
      <g>
        <rect x="128" y="28" width="56" height="22" rx="11" fill={al} />
        <circle cx="141" cy="39" r="9" fill={a} opacity="0.25" className="anim-ping" />
        <circle cx="141" cy="39" r="4.5" fill={a} />
        <text x="160" y="43" textAnchor="middle" fontSize="11" fontWeight="800" fill={a} fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.5">LIVE</text>
      </g>
      {/* tick */}
      <circle cx="42" cy="38" r="11" fill={g} />
      <path d="M36.5 38 l4 4 l7 -8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
