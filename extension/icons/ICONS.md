# Icon files

Chrome Web Store requires three PNG sizes:

- `icon-16.png` — 16×16 (toolbar favicon)
- `icon-48.png` — 48×48 (extension management page)
- `icon-128.png` — 128×128 (store listing)

## Source

`icon.svg` is the canonical source — editorial sparkle on a teal-deep →
teal gradient, matching the ReviewHub brand mark used on the website
(`client/src/components/Logo.jsx`, `client/public/favicon.svg`,
`client/public/logo.svg`).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="rh-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1e4d5e"/>
      <stop offset="1" stop-color="#2c7889"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#rh-grad)"/>
  <path d="M32 10c1.5 10 4 12.5 14 14-10 1.5-12.5 4-14 14-1.5-10-4-12.5-14-14 10-1.5 12.5-4 14-14z" fill="#fbf8f1"/>
  <path d="M48 40c.7 4 1.6 4.9 5.5 5.5-3.9.6-4.8 1.5-5.5 5.5-.6-4-1.5-4.9-5.5-5.5 4-.6 4.9-1.5 5.5-5.5z" fill="#fbf8f1" opacity="0.95"/>
</svg>
```

## Regeneration

If `icon.svg` ever changes, regenerate the three PNGs from the project root:

```bash
node -e "
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const dir = 'extension/icons';
const svg = fs.readFileSync(path.join(dir, 'icon.svg'));
(async () => {
  for (const size of [16, 48, 128]) {
    await sharp(svg, { density: 600 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, 'icon-' + size + '.png'));
  }
})();
"
```

`sharp` is the only dependency. The sparkle still reads at 16×16 because
the inner glyph stays at ~50% of the canvas.

## Branding rules

- **Tile gradient:** teal-deep `#1e4d5e` → teal `#2c7889` (matches
  `--rh-teal-deep` → `--rh-teal` design tokens in the web app)
- **Sparkle fill:** paper cream `#fbf8f1` (matches `--rh-paper`)
- **Corner radius:** 14/64 of the viewBox (~22%) — same as the web favicon
- Do NOT use the legacy blue/indigo gradient (`#6366f1`/`#8b5cf6`) — that
  was the pre-editorial palette and has been retired everywhere else.
