// landing-demo.jsx — AI draft demo with live Claude calls

const SAMPLE_REVIEWS = {
  glowing: {
    name: "Priya M.",
    plat: "Google",
    stars: 5,
    body: "Came here on my anniversary. Staff noticed, brought out a little candle on the tiramisu. Small thing — made the night. Thank you."
  },
  mixed: {
    name: "Dan T.",
    plat: "Yelp",
    stars: 3,
    body: "Pasta was excellent. Service took forever though — 40 minutes for the mains on a Tuesday. Wanted to love it more than I did."
  },
  harsh: {
    name: "Anon.",
    plat: "TripAdvisor",
    stars: 1,
    body: "Rude manager. Overpriced. Never coming back. Zero stars if I could."
  }
};

const TONE_PRESETS = [
  { id: "warm", label: "Warm" },
  { id: "brisk", label: "Brisk" },
  { id: "formal", label: "Formal" }
];

function AiDemo() {
  const [which, setWhich] = React.useState("mixed");
  const [tone, setTone] = React.useState("warm");
  const [output, setOutput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const review = SAMPLE_REVIEWS[which];

  async function generate() {
    setLoading(true);
    setOutput("");
    try {
      const prompt = `You are the owner of a small neighborhood restaurant. Write a reply to the following review. Tone: ${tone}. Keep it under 45 words. Do not start with "Thank you" — start with the reviewer's first name if natural. Be specific to what they mentioned. No emojis unless the review has one.\n\nREVIEW (${review.stars} stars on ${review.plat}, by ${review.name}):\n"${review.body}"\n\nREPLY:`;
      const text = await window.claude.complete(prompt);
      // Typewriter effect
      let i = 0;
      const interval = setInterval(() => {
        i += 2;
        setOutput(text.slice(0, i));
        if (i >= text.length) clearInterval(interval);
      }, 18);
    } catch (e) {
      setOutput("Couldn't reach the draft service — try again in a sec.");
    } finally {
      setLoading(false);
    }
  }

  const Stars = window.Stars;

  return (
    <section className="section" id="demo">
      <div className="shell">
        <div className="section-head">
          <div className="mono">§ 02 · Live</div>
          <h2 className="reveal">Draft one now. <em>It's really running.</em></h2>
        </div>
        <div className="demo reveal">
          <div className="demo-card">
            <div className="head">
              <div className="title">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ink-3)" }}></span>
                The review
              </div>
              <div className="chips">
                {Object.entries(SAMPLE_REVIEWS).map(([k, v]) => (
                  <button key={k} className={"chip" + (which === k ? " active" : "")} onClick={() => { setWhich(k); setOutput(""); }}>
                    {v.stars}★ {k}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{review.name}</div>
                <Stars n={review.stars} />
                <div className="mono" style={{ fontSize: 10 }}>{review.plat}</div>
              </div>
            </div>
            <div className="out" style={{ color: "var(--ink-2)" }}>"{review.body}"</div>
            <div className="foot">
              <div className="chips">
                <span className="mono" style={{ color: "var(--ink-3)", padding: "4px 0" }}>Tone:</span>
                {TONE_PRESETS.map(p => (
                  <button key={p.id} className={"chip" + (tone === p.id ? " active" : "")} onClick={() => setTone(p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={generate} disabled={loading}>
                {loading ? "Drafting…" : "Draft reply →"}
              </button>
            </div>
          </div>

          <div className="demo-card demo-out-card">
            <div className="head">
              <div className="title">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)" }}></span>
                AI draft · in your voice
              </div>
              <div className="mono" style={{ color: "var(--accent)" }}>Claude Haiku</div>
            </div>
            <div className={"out" + (loading ? " typing" : "")}>
              {output || (
                <span style={{ color: "var(--ink-3)" }}>
                  Hit <b style={{ color: "var(--ink-2)" }}>Draft reply</b> to see a real response from our drafting model. Change the tone or pick a different review — each run is live.
                </span>
              )}
            </div>
            <div className="foot">
              <div className="mono" style={{ color: "var(--ink-3)" }}>
                {output ? `${output.split(/\s+/).filter(Boolean).length} words` : "—"}
              </div>
              <button className="btn btn-ghost" disabled={!output}>Post to {review.plat} →</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { AiDemo });
