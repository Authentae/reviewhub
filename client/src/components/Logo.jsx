import React from 'react';

// ReviewHub brand mark — Concept C (AI Sparkle), editorial palette.
//
// Pure 4-point sparkle (large center + small corner accent) on a rounded-square
// tile. The sparkle reads as "AI / something new" rather than "review star",
// giving the brand a more software-forward feel that matches the editorial
// landing page voice.
//
// Palette: teal gradient on the tile, paper-cream sparkles. Replaces the old
// blue tech-gradient (#2563eb → #6366f1) which clashed with the warm
// editorial cream/teal/ochre/sage system.
//
// Props:
//   size      — integer px. Default 32. Use 16 for favicons, 24-28 for navbar,
//               36-48 for hero surfaces.
//   variant   — 'gradient' (default), 'mono', 'ink', 'paper'.
//                 gradient: teal gradient tile, paper sparkle (default app use)
//                 mono:     slate-900 tile, paper sparkle (email / print)
//                 ink:      solid ink tile, paper sparkle (dark sections)
//                 paper:    paper tile, ink sparkle (favicon on light, footer)
//   mono      — boolean alias for variant='mono' (kept for back-compat).
//   className — optional wrapper class.
//
// Each instance gets a unique gradient id to avoid duplicate-id collisions
// when multiple Logos render on the same page.
let _logoInstanceCounter = 0;

const PALETTE = {
  // Editorial teal gradient (matches --rh-teal-deep → --rh-teal in design-system.css)
  tealFrom: '#1e4d5e',
  tealTo:   '#2c7889',
  // Editorial ink (matches --rh-ink)
  ink:      '#1d242c',
  // Editorial paper (matches --rh-paper)
  paper:    '#fbf8f1',
  // Slate fallback for mono variant (kept identical to legacy mono color)
  slate:    '#0f172a',
};

export default function Logo({ size = 32, variant, mono = false, className, title = 'ReviewHub', ...rest }) {
  // Resolve back-compat: mono prop maps to variant='mono'.
  const v = variant || (mono ? 'mono' : 'gradient');
  const gradientId = React.useMemo(() => `rh-logo-grad-${++_logoInstanceCounter}`, []);

  // Tile fill: gradient | solid color
  let tileFill;
  let sparkleFill;
  let needsGradient = false;
  switch (v) {
    case 'mono':
      tileFill = PALETTE.slate;
      sparkleFill = PALETTE.paper;
      break;
    case 'ink':
      tileFill = PALETTE.ink;
      sparkleFill = PALETTE.paper;
      break;
    case 'paper':
      tileFill = PALETTE.paper;
      sparkleFill = PALETTE.ink;
      break;
    case 'gradient':
    default:
      tileFill = `url(#${gradientId})`;
      sparkleFill = PALETTE.paper;
      needsGradient = true;
      break;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {needsGradient && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={PALETTE.tealFrom} />
            <stop offset="1" stopColor={PALETTE.tealTo} />
          </linearGradient>
        </defs>
      )}
      <rect width="64" height="64" rx="14" fill={tileFill} />
      {/* Large 4-point sparkle, centered slightly upper-left */}
      <path
        d="M32 10c1.5 10 4 12.5 14 14-10 1.5-12.5 4-14 14-1.5-10-4-12.5-14-14 10-1.5 12.5-4 14-14z"
        fill={sparkleFill}
      />
      {/* Small accent sparkle in lower-right */}
      <path
        d="M48 40c.7 4 1.6 4.9 5.5 5.5-3.9.6-4.8 1.5-5.5 5.5-.6-4-1.5-4.9-5.5-5.5 4-.6 4.9-1.5 5.5-5.5z"
        fill={sparkleFill}
        opacity="0.95"
      />
    </svg>
  );
}
