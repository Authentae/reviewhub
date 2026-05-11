# Claude Design handoff bundles

When Earth clicks Share → Handoff to Claude Code on a design in
claude.ai/design, the resulting tarball lands here for the coding
agent (me / future Claude Code) to read.

## How to use

1. Read the bundle's own README first (e.g.
   `audit-preview-v2/README.md`) — it tells the agent the conventions.
2. Read the chat transcript (`*/chats/chat1.md`) — that's where the
   user's intent lives.
3. Read the specific design HTML in `*/project/*.html` — pixel-perfect
   spec lives in the inline CSS + JSX.
4. Port to a real React component in `client/src/`.

Per Claude Design's own README: don't render these in a browser or
screenshot them — read the source.

## Current bundles

### `audit-preview-v2/` — 5 designs

- `ReviewHub LINE Mockup.html` → already ported to
  `client/src/components/LineFlexCardMockup.jsx` (commit daa757a)
- `ReviewHub Hero Animation.html` → already ported to
  `client/src/components/HeroAnimation.jsx` (commit d1ad3cd)
- `ReviewHub About Page.html` → already ported to
  `client/src/pages/About.jsx` (commit 1908e1a)
- `ReviewHub Founder Daily Brief.html` → already ported to
  `client/src/pages/FounderBrief.jsx` (commit 2c3e519)
- **`ReviewHub One-Star Playbook.html` → NOT YET PORTED.** Should ship at
  `/tools/one-star-playbook`. Interactive 4-scenario decision tree, ~30
  min port from this source. Read the file, then write the React
  component.
