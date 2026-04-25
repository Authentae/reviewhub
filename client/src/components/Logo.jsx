import React from 'react';

// ReviewHub brand mark — Concept A (Star + Spark).
//
// A rounded-square brand tile with a centered 5-point review star and a
// small sparkle-cornered ring in the upper right. Works at 16px (favicon)
// through 256px (app icons) without redrawing.
//
// Props:
//   size  — integer px. Default 32. Use 16 for favicons, 24-28 for navbar,
//           36-48 for hero surfaces.
//   mono  — render in slate-900 instead of the brand gradient. Use for
//           monochrome contexts (some favicons, print, email fallback).
//   className — optional wrapper class (e.g. to add hover transform).
//
// The SVG has a unique gradient id per-instance to avoid duplicate-id
// collisions when multiple Logos render on the same page.
let _logoInstanceCounter = 0;

export default function Logo({ size = 32, mono = false, className, title = 'ReviewHub', ...rest }) {
  const gradientId = React.useMemo(() => `rh-logo-grad-${++_logoInstanceCounter}`, []);
  const fill = mono ? '#0f172a' : `url(#${gradientId})`;

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
      {!mono && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2563eb" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
      )}
      <rect width="64" height="64" rx="14" fill={fill} />
      <path
        d="M30 18l4 9 10 1-7.5 6.5 2.2 9.5L30 39l-8.7 5 2.2-9.5L16 28l10-1 4-9z"
        fill="#fff"
      />
      <circle cx="47" cy="18" r="3.2" fill="#fff" />
      <circle cx="47" cy="18" r="1.4" fill={fill} />
    </svg>
  );
}
