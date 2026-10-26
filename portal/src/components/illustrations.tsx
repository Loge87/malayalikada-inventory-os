/* Sleek, modern UI-style SVG illustrations for the home page's value cards:
   glass-like cards, thin lines and a vivid gradient accent per card. */

const ink = "#0f1a14";
const line = "#e3e8ee";
const FONT = "ui-sans-serif, system-ui, sans-serif";

type Tone = { c1: string; c2: string; tint: string };
export const TONES = {
  green: { c1: "#22a35a", c2: "#0f6b3a", tint: "#e6f6ec" },
  teal: { c1: "#1fb5c9", c2: "#0b6e99", tint: "#e3f5f9" },
  violet: { c1: "#8b6cff", c2: "#5a3fd6", tint: "#eeeaff" },
  amber: { c1: "#ffb020", c2: "#e8710a", tint: "#fff1dc" },
} satisfies Record<string, Tone>;

function Defs({ id, t }: { id: string; t: Tone }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
        <stop offset="0" stopColor={t.c1} stopOpacity="0.28" />
        <stop offset="1" stopColor={t.c1} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={t.c1} />
        <stop offset="1" stopColor={t.c2} />
      </linearGradient>
      <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor={t.c2} floodOpacity="0.22" />
      </filter>
    </defs>
  );
}

/** An isometric case with a per-case trade price — "priced by the case". */
export function CasePriceIllustration() {
  const t = TONES.green;
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A case of products with a trade price per case">
      <Defs id="cp" t={t} />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#cp-glow)" />
      <ellipse cx="110" cy="118" rx="40" ry="6" fill={t.c2} opacity="0.16" />
      <g className="anim-float" filter="url(#cp-sh)">
        <path d="M78 54 L110 38 L142 54 L110 70 Z" fill={t.tint} stroke={t.c1} strokeOpacity="0.6" strokeLinejoin="round" />
        <path d="M78 54 L110 70 V108 L78 92 Z" fill="url(#cp-g)" />
        <path d="M142 54 L110 70 V108 L142 92 Z" fill={t.c2} />
        <path d="M94 46 L126 62" stroke="#fff" strokeOpacity="0.85" strokeWidth="5" strokeLinecap="round" />
        <path d="M86 78 l16 8 v10 l-16 -8 Z" fill="#fff" fillOpacity="0.92" />
        <path d="M89.5 82.5 l9 4.5 M89.5 88 l6 3" stroke={t.c2} strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g filter="url(#cp-sh)">
        <rect x="122" y="14" width="88" height="36" rx="12" fill="#fff" stroke={line} />
      </g>
      <text x="134" y="30" fontSize="8" fontWeight="600" fill={ink} opacity="0.5" fontFamily={FONT} letterSpacing="0.6">TRADE PRICE</text>
      <text x="134" y="43.5" fontSize="13.5" fontWeight="800" fill={ink} fontFamily={FONT}>$48.00</text>
      <rect x="176" y="33" width="28" height="12" rx="6" fill={t.tint} />
      <text x="190" y="42" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={t.c2} fontFamily={FONT}>/ case</text>
      <g filter="url(#cp-sh)">
        <rect x="12" y="92" width="72" height="28" rx="14" fill="#fff" stroke={line} />
      </g>
      <circle cx="27" cy="106" r="8" fill={t.tint} />
      <path d="M23.5 106 h7" stroke={t.c2} strokeWidth="2" strokeLinecap="round" />
      <text x="48" y="110" textAnchor="middle" fontSize="11" fontWeight="800" fill={ink} fontFamily={FONT}>12</text>
      <circle cx="69" cy="106" r="8" fill="url(#cp-g)" />
      <path d="M65.5 106 h7 M69 102.5 v7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A live stock panel with availability bars — "live stock". */
export function LiveStockIllustration() {
  const t = TONES.teal;
  const rows = [
    { y: 62, w: 92, ok: true },
    { y: 86, w: 60, ok: true },
    { y: 110, w: 20, ok: false },
  ];
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A live stock panel with availability bars">
      <Defs id="ls" t={t} />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#ls-glow)" />
      <g filter="url(#ls-sh)">
        <rect x="24" y="20" width="172" height="116" rx="16" fill="#fff" stroke={line} />
      </g>
      <rect x="40" y="35" width="56" height="7" rx="3.5" fill={ink} opacity="0.82" />
      <rect x="140" y="30" width="46" height="17" rx="8.5" fill={t.tint} />
      <circle cx="152" cy="38.5" r="7" fill={t.c1} opacity="0.35" className="anim-ping" />
      <circle cx="152" cy="38.5" r="3" fill={t.c1} />
      <text x="170" y="42" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={t.c2} fontFamily={FONT} letterSpacing="0.6">LIVE</text>
      {rows.map((r) => (
        <g key={r.y}>
          <rect x="40" y={r.y - 7} width="15" height="15" rx="4.5" fill={r.ok ? t.tint : TONES.amber.tint} />
          <rect x="63" y={r.y - 6} width="40" height="4.5" rx="2.25" fill={ink} opacity="0.16" />
          <rect x="63" y={r.y + 2} width="100" height="5.5" rx="2.75" fill={r.ok ? t.tint : TONES.amber.tint} />
          <rect x="63" y={r.y + 2} width={r.w} height="5.5" rx="2.75" fill={r.ok ? "url(#ls-g)" : TONES.amber.c1} />
          <circle cx="180" cy={r.y + 0.5} r="5.5" fill={r.ok ? t.c1 : TONES.amber.c1} />
          {r.ok ? (
            <path d={`M177.3 ${r.y + 0.5} l2 2 l3.6 -4`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={`M180 ${r.y - 2.5} v3.4 M180 ${r.y + 3.2} v0.2`} stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
          )}
        </g>
      ))}
    </svg>
  );
}

/** A spreadsheet flowing into a cart — "quick order from a spreadsheet". */
export function QuickOrderIllustration() {
  const t = TONES.violet;
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="A spreadsheet being added to a cart">
      <Defs id="qo" t={t} />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#qo-glow)" />
      {/* sheet */}
      <g filter="url(#qo-sh)">
        <rect x="18" y="24" width="108" height="100" rx="14" fill="#fff" stroke={line} />
      </g>
      <rect x="18" y="24" width="108" height="22" rx="14" fill="url(#qo-g)" />
      <rect x="18" y="38" width="108" height="8" fill="url(#qo-g)" />
      <text x="32" y="39" fontSize="9" fontWeight="800" fill="#fff" fontFamily={FONT} letterSpacing="0.5">ORDER.XLSX</text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="30" y={56 + i * 17} width="42" height="6" rx="3" fill={ink} opacity={i === 0 ? 0.55 : 0.18} />
          <rect x="82" y={56 + i * 17} width="14" height="6" rx="3" fill={t.c1} opacity="0.55" />
          <rect x="102" y={56 + i * 17} width="12" height="6" rx="3" fill={ink} opacity="0.12" />
        </g>
      ))}
      {/* arrow */}
      <g className="anim-float">
        <circle cx="136" cy="76" r="11" fill="#fff" stroke={line} />
        <path d="M131 76 h10 m-4 -4 l4 4 l-4 4" fill="none" stroke={t.c2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* cart */}
      <g filter="url(#qo-sh)">
        <rect x="152" y="50" width="56" height="52" rx="14" fill="url(#qo-g)" />
      </g>
      <path d="M165 66 h4 l3.5 14 h14 l3 -10 h-19" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="175" cy="86" r="2.2" fill="#fff" />
      <circle cx="186" cy="86" r="2.2" fill="#fff" />
      <circle cx="203" cy="52" r="10" fill="#fff" stroke={t.c1} strokeWidth="2" />
      <text x="203" y="56" textAnchor="middle" fontSize="11" fontWeight="800" fill={t.c2} fontFamily={FONT}>24</text>
    </svg>
  );
}

/** An order timeline with status — "track every order". */
export function OrderTrackingIllustration() {
  const t = TONES.amber;
  const steps = [
    { y: 58, label: "Placed", done: true },
    { y: 84, label: "Confirmed", done: true },
    { y: 110, label: "Ready", done: false },
  ];
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" role="img" aria-label="An order moving through placed, confirmed and ready">
      <Defs id="ot" t={t} />
      <ellipse cx="110" cy="72" rx="104" ry="68" fill="url(#ot-glow)" />
      <g filter="url(#ot-sh)">
        <rect x="26" y="18" width="168" height="118" rx="16" fill="#fff" stroke={line} />
      </g>
      <rect x="42" y="33" width="46" height="7" rx="3.5" fill={ink} opacity="0.82" />
      <rect x="42" y="45" width="30" height="4.5" rx="2.25" fill={ink} opacity="0.18" />
      <rect x="132" y="30" width="48" height="18" rx="9" fill={t.tint} />
      <text x="156" y="42.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill={t.c2} fontFamily={FONT} letterSpacing="0.4">IN PROGRESS</text>
      {/* rail */}
      <path d="M54 62 V108" stroke={line} strokeWidth="3" strokeLinecap="round" />
      <path d="M54 62 V86" stroke="url(#ot-g)" strokeWidth="3" strokeLinecap="round" />
      {steps.map((s) => (
        <g key={s.y}>
          <circle cx="54" cy={s.y} r="8" fill={s.done ? "url(#ot-g)" : "#fff"} stroke={s.done ? "none" : t.c1} strokeWidth="2" />
          {s.done ? (
            <path d={`M50.5 ${s.y} l2.5 2.5 l4.5 -5`} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <circle cx="54" cy={s.y} r="2.5" fill={t.c1} className="anim-ping" />
          )}
          <rect x="72" y={s.y - 6} width={s.label.length * 5 + 14} height="6" rx="3" fill={ink} opacity={s.done ? 0.7 : 0.25} />
          <rect x="72" y={s.y + 3} width="54" height="4" rx="2" fill={ink} opacity="0.1" />
        </g>
      ))}
    </svg>
  );
}
