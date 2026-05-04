// landing-sections.jsx — ReviewHub landing page sections

function Star({ filled = true }) {
  return (
    <svg className="star-svg" viewBox="0 0 16 16" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.2}>
      <path d="M8 1.5l2 4.4 4.8.4-3.7 3.2 1.1 4.7L8 11.8 3.8 14.2l1.1-4.7L1.2 6.3l4.8-.4L8 1.5z" />
    </svg>
  );
}

function Stars({ n = 5, dim = false }) {
  return (
    <span className={"stars" + (dim ? " dim" : "")}>
      {Array.from({ length: 5 }).map((_, i) => <Star key={i} filled={i < n} />)}
    </span>
  );
}

function Logo() {
  return (
    <a className="brand" href="#">
      <div className="mark">r</div>
      <div className="wm">Review<em>Hub</em></div>
    </a>
  );
}

function Nav({ tone }) {
  return (
    <nav className="top">
      <div className="shell bar">
        <Logo />
        <div className="nav-links">
          <a href="#platforms">Platforms</a>
          <a href="#how">How it works</a>
          <a href="#demo">AI drafts</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-cta">
          <a href="#" className="btn btn-ghost">Sign in</a>
          <a href="#cta" className="btn btn-primary">{tone.ctaSub} →</a>
        </div>
      </div>
    </nav>
  );
}

function Hero({ tone, heroVariant }) {
  const [h1, em1, mid, em2] = tone.headline;
  return (
    <section className="hero">
      <div className="shell hero-grid">
        <div>
          <div className="eyebrow">
            <span className="dot" />
            <span className="mono">Live · 2,847 replies sent today</span>
          </div>
          <h1 className="display">
            {h1}{" "}
            <em>{em1}</em>
            <span className="italic"> </span>
            {mid}
            <em>{em2}</em>
          </h1>
          <p className="lede">{tone.lede}</p>
          <div className="hero-cta">
            <a href="#cta" className="btn btn-primary btn-lg">{tone.cta} →</a>
            <a href="#demo" className="btn btn-ghost btn-lg">See a live draft</a>
          </div>
          <div className="trust">
            <div className="metric">
              <div className="n">4.9<span style={{ fontSize: 18, color: "var(--ink-3)" }}>/5</span></div>
              <div className="l">Chrome Web Store</div>
            </div>
            <div className="metric">
              <div className="n">12s</div>
              <div className="l">Median reply time</div>
            </div>
            <div className="metric">
              <div className="n">6</div>
              <div className="l">Platforms, one inbox</div>
            </div>
          </div>
        </div>
        {heroVariant === "live-feed" ? <LiveFeed /> : <BigType />}
      </div>
    </section>
  );
}

function BigType() {
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: 440 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: "clamp(120px, 22vw, 280px)", lineHeight: 0.9, letterSpacing: "-0.04em", color: "var(--ink)", fontStyle: "italic" }}>
        ★<span style={{ color: "var(--accent)" }}>★</span>★★★
      </div>
    </div>
  );
}

function Platforms() {
  const items = [
    { name: "Google", sub: "Business Profile" },
    { name: "Yelp", sub: "Biz API" },
    { name: "Facebook", sub: "Pages" },
    { name: "Tripadvisor", sub: "Owners" },
    { name: "Trustpilot", sub: "Business" },
    { name: "Wongnai", sub: "Thailand" }
  ];
  return (
    <section className="platforms" id="platforms">
      <div className="shell">
        <div className="mono label">— Ingests reviews from —</div>
        <div className="plat-row">
          {items.map((p, i) => (
            <div key={i} className="reveal">
              {p.name}
              <small>{p.sub}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="shell">
        <div className="section-head">
          <div className="mono">§ 01 · Workflow</div>
          <h2 className="reveal">Three steps to an <em>empty</em> review queue.</h2>
        </div>
        <div className="steps">
          <div className="step reveal">
            <div className="num">01 · Connect</div>
            <h3>Paste a link,<br/>we pull the reviews.</h3>
            <p>Google OAuth takes 20 seconds. Other platforms accept a public URL or a CSV while their APIs warm up.</p>
            <div className="sketch">
              <svg width="80%" height="80%" viewBox="0 0 200 100">
                <rect x="10" y="30" width="130" height="40" rx="8" fill="var(--paper)" stroke="var(--rule)" />
                <text x="22" y="55" fontFamily="var(--mono)" fontSize="11" fill="var(--ink-3)">https://g.page/cafe-</text>
                <rect x="150" y="30" width="40" height="40" rx="8" fill="var(--ink)" />
                <text x="170" y="55" fontFamily="var(--sans)" fontSize="12" fill="var(--paper)" textAnchor="middle" fontWeight="600">Add</text>
              </svg>
            </div>
          </div>
          <div className="step reveal">
            <div className="num">02 · Draft</div>
            <h3>AI drafts in<br/><em style={{ fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--accent)" }}>your voice.</em></h3>
            <p>Trained on your last 20 replies — not on "delight exceptional amazing." Outputs sound like you, in any of 10 languages.</p>
            <div className="sketch" style={{ padding: 14, alignItems: "flex-start", justifyContent: "flex-start", textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Draft</span>
                <br/>
                "Appreciate you stopping by, Marco — pour-over's back Thursday. See you then."
              </div>
            </div>
          </div>
          <div className="step reveal">
            <div className="num">03 · Post</div>
            <h3>One tap.<br/>It's published.</h3>
            <p>The extension posts on whatever platform page you're on — no copy-paste, no tab juggling, no logins to remember.</p>
            <div className="sketch">
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.06em" }}>MEDIAN</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1, color: "var(--ink)" }}>12<span style={{ fontSize: 20, color: "var(--ink-3)" }}>s</span></div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ok)", letterSpacing: "0.08em" }}>← 94% faster</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureGrid() {
  const days = [38, 42, 55, 49, 61, 58, 72, 65, 78, 82, 79, 91];
  return (
    <section className="section" id="features">
      <div className="shell">
        <div className="section-head">
          <div className="mono">§ 03 · The rest of the system</div>
          <h2 className="reveal">Built for operators, <em>not managers.</em></h2>
        </div>
        <div className="feat-grid">
          <div className="feat x6 reveal">
            <div className="tag">Trends</div>
            <h4>Ratings that <em>move</em>, over time.</h4>
            <p>Sparklines per platform, weekly digest in your inbox, alerts when sentiment drops two notches in a week.</p>
            <div className="viz">
              <div className="spark">
                {days.map((d, i) => (
                  <span key={i} className={i > 8 ? "hi" : ""} style={{ height: `${d}%` }} />
                ))}
              </div>
            </div>
          </div>
          <div className="feat x6 reveal">
            <div className="tag">Sentiment</div>
            <h4>Know what's <em>actually</em> being said.</h4>
            <p>Every review tagged positive / neutral / negative with a one-line "why." Filter the feed, export to CSV.</p>
            <div className="viz senti">
              <div className="bar pos"><div className="n">72%</div><div className="l">Positive</div></div>
              <div className="bar neu"><div className="n">19%</div><div className="l">Neutral</div></div>
              <div className="bar neg"><div className="n">9%</div><div className="l">Negative</div></div>
            </div>
          </div>
          <div className="feat x4 reveal">
            <div className="tag">Team</div>
            <h4>Roles, seats,<br/>audit log.</h4>
            <p>Owner, manager, responder. Every reply attributable.</p>
          </div>
          <div className="feat x4 reveal">
            <div className="tag">i18n · 10 languages</div>
            <h4>Thai, Japanese,<br/>Korean — native.</h4>
            <p>Drafts in the guest's language, not via translate.</p>
            <div className="viz i18n-row" style={{ marginTop: 12 }}>
              {["EN","ES","FR","DE","PT","IT","TH","JA","ZH","KO"].map((l, i) => (
                <span key={l} className={"lang" + (i === 6 ? " on" : "")}>{l}</span>
              ))}
            </div>
          </div>
          <div className="feat x4 reveal">
            <div className="tag">Review requests</div>
            <h4>Ask, at the<br/>right moment.</h4>
            <p>QR codes, SMS links, follow-up emails — measured conversion.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="shell">
        <div className="section-head">
          <div className="mono">§ 04 · Pricing</div>
          <h2 className="reveal">Priced like we're <em>building it ourselves.</em></h2>
        </div>
        <div className="price-grid">
          <div className="plan reveal">
            <div className="plan-name">Solo</div>
            <div className="plan-price">$0<small>/mo</small></div>
            <div className="plan-sub">One location, forever.</div>
            <ul>
              <li>Up to 50 reviews / month</li>
              <li>2 platforms</li>
              <li>AI drafts (template fallback)</li>
              <li>Chrome extension</li>
            </ul>
            <a href="#" className="btn btn-ghost">Start free</a>
          </div>
          <div className="plan featured reveal">
            <div className="badge">Most popular</div>
            <div className="plan-name">Shop</div>
            <div className="plan-price">$19<small>/mo</small></div>
            <div className="plan-sub">For the place with a real front door.</div>
            <ul>
              <li>Unlimited reviews</li>
              <li>All 6 platforms</li>
              <li>Claude-powered drafts</li>
              <li>Sentiment, trends, weekly digest</li>
              <li>3 teammates</li>
            </ul>
            <a href="#" className="btn btn-primary" style={{ background: "var(--paper)", color: "var(--ink)" }}>Start 14-day trial</a>
          </div>
          <div className="plan reveal">
            <div className="plan-name">Chain</div>
            <div className="plan-price">$49<small>/mo</small></div>
            <div className="plan-sub">For multi-location operators.</div>
            <ul>
              <li>Everything in Shop</li>
              <li>Up to 10 locations</li>
              <li>Unlimited teammates, roles + audit log</li>
              <li>API + webhooks</li>
              <li>Priority support</li>
            </ul>
            <a href="#" className="btn btn-ghost">Start 14-day trial</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    { q: "Do I need to give you login access to Google, Yelp, etc.?", a: "No. Google uses OAuth — you approve a scoped token that only reads reviews and posts replies on your behalf. For the other platforms, the Chrome extension posts replies as you, on the page you're already signed into. We never see or store your passwords." },
    { q: "What happens if the AI draft is off?", a: "You edit it before hitting send — same as any other draft. Over time the model learns your cadence from the edits; drafts stop needing edits around week three for most users. You can also turn AI off entirely and use ReviewHub as a read-only aggregator." },
    { q: "Can I try it without a credit card?", a: "Yes. Solo is free forever for one location. Shop and Chain come with a 14-day trial that does not require a card. If you forget to cancel we just downgrade you." },
    { q: "Why does the Thai-language part get top billing?", a: "Because Wongnai matters if you're in Thailand, and nobody else in this category handles it properly. Half our team lives in Chiang Mai. We eat our own pad thai." },
    { q: "Is there an API?", a: "Yes, on the Chain plan. Webhooks for new reviews, posted replies, and sentiment alerts; REST for read-only reporting. Documented at docs.reviewhub.app." },
    { q: "Where does my data live?", a: "SQLite on our servers in Singapore (APAC) or Frankfurt (EU), your pick. Nightly encrypted backups. You can export or delete everything on request — one-click from Settings → Data." }
  ];
  return (
    <section className="section" id="faq">
      <div className="shell">
        <div className="section-head">
          <div className="mono">§ 05 · Common questions</div>
          <h2 className="reveal">Everything else.</h2>
        </div>
        <div className="faq">
          {items.map((it, i) => (
            <details key={i} open={i === 0}>
              <summary>{it.q}</summary>
              <p>{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function BigCta({ tone }) {
  return (
    <section className="big-cta" id="cta">
      <div className="shell">
        <div className="mono" style={{ color: "color-mix(in oklab, var(--paper) 50%, transparent)", marginBottom: 18 }}>— Ready when you are —</div>
        <h2>Clear the queue by <em>lunch.</em></h2>
        <p>Install the extension, paste one Google link, post your first AI-drafted reply inside two minutes. No card, no meeting, no onboarding webinar.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#" className="btn btn-primary btn-lg">{tone.cta} →</a>
          <a href="#" className="btn btn-ghost btn-lg">Watch a 60-sec demo</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="shell">
        <div className="foot-grid">
          <div>
            <Logo />
            <p className="note">The reply layer for local business. Built in Chiang Mai and Brooklyn, shipping since 2026.</p>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li><a href="#">Extension</a></li>
              <li><a href="#">Dashboard</a></li>
              <li><a href="#">AI drafts</a></li>
              <li><a href="#">Review requests</a></li>
              <li><a href="#">Analytics</a></li>
            </ul>
          </div>
          <div>
            <h5>Company</h5>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Changelog</a></li>
              <li><a href="#">Status</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div>
            <h5>Legal</h5>
            <ul>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Acceptable use</a></li>
              <li><a href="#">Refunds</a></li>
            </ul>
          </div>
        </div>
        <div className="copy">
          <div>© 2026 ReviewHub</div>
          <div className="mono">v2.4.1 · all systems nominal</div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { Nav, Hero, Platforms, HowItWorks, FeatureGrid, Pricing, Faq, BigCta, Footer, Star, Stars, Logo });
