# Icon files

Chrome Web Store requires three PNG sizes:

- `icon-16.png` — 16×16 (toolbar favicon)
- `icon-48.png` — 48×48 (extension management page)
- `icon-128.png` — 128×128 (store listing)

## Quick generation

Any square logo in the brand gradient (`#6366f1` → `#8b5cf6`) with a white
sparkle ✨ in the center works.

Simplest generator — SVG source, then export at 16/48/128:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <text x="64" y="86" text-anchor="middle" font-size="72"
        fill="white">✨</text>
</svg>
```

Save as `icon.svg`, then with any image tool (Figma, Sketch, online
SVG→PNG converter, ImageMagick):

```bash
convert -background none icon.svg -resize 16x16 icon-16.png
convert -background none icon.svg -resize 48x48 icon-48.png
convert -background none icon.svg -resize 128x128 icon-128.png
```

Or online: <https://svgviewer.dev/> → export PNG at each size.

Until real icons are added, Chrome will use a default gray placeholder for
unpacked extensions — fine for local testing, but required for store upload.
