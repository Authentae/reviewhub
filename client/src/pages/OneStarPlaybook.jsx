// /tools/one-star-playbook — free decision-tree playbook for owners who just
// got a 1-star Google review. Four scenario buckets (legitimate-specific,
// legitimate-pattern, competitor/serial, extortion) each with a Thai+English
// reply template, why-it-works rationale, and what-not-to-say list.
//
// Ported 2026-05-12 from a claude.ai/design artifact (handoff bundle archived
// at docs/claude-design-handoffs/audit-preview-v2/). Static content + small
// state machine — no backend calls. SEO target: "1 star google review reply",
// "how to respond to bad google review hotel bangkok", "extortion review".
//
// CTA at the bottom funnels to /audit (paste-a-review → free hand-crafted
// audit) — the same conversion path as the other free tools.

import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import MarketingFooter from '../components/MarketingFooter';
import usePageTitle from '../hooks/usePageTitle';
import useSocialMeta from '../hooks/useSocialMeta';
import { useI18n } from '../context/I18nContext';

const RESULTS = {
  specific: {
    badgeClass: 'specific',
    label: '01 · LEGITIMATE · SPECIFIC',
    title: 'Specific acknowledgment + concrete action.',
    thai: 'ขออภัยจริงๆ ค่ะ คุณ[name] เรื่อง[specific issue] เราได้เปลี่ยน[concrete fix]แล้วเมื่อ[date] หวังว่าจะมีโอกาสให้บริการอีกครั้งค่ะ — [your name], [hotel name]',
    en: "I'm truly sorry, Khun [name], about [specific issue]. We changed [concrete fix] on [date]. I hope we get the chance to host you again. — [your name], [hotel name]",
    why: 'Naming the issue and the fix shows future readers that you actually run the place. Generic apologies read as defensive. Specificity reads as accountability.',
    dont: [
      '"Sorry you feel that way" — defensive phrase that signals you don\'t agree.',
      "Promising a fix you can't actually ship by next week — future guests will check.",
    ],
  },
  pattern: {
    badgeClass: 'pattern',
    label: '02 · LEGITIMATE · PATTERN',
    title: 'Acknowledge the pattern, take it offline.',
    thai: 'ขอบคุณที่แจ้งค่ะ คุณ[name] เป็นเรื่องที่เรากำลังทำงานเพื่อปรับปรุงอยู่ค่ะ รบกวนส่งรายละเอียดมาที่ [email] เพื่อให้เราดูแลคุณเป็นการส่วนตัว — [your name], [hotel name]',
    en: "Thank you for telling us, Khun [name]. This is something we're actively working on. Please email us at [email] so we can take care of you directly. — [your name], [hotel name]",
    why: "You're not denying the issue — denying a real pattern in public makes it worse. You're moving the detailed conversation off the public feed.",
    dont: [
      'Listing your own counter-evidence in public — readers see "owner is fighting back."',
      "Apologizing for a problem you haven't actually fixed yet — over-promising erodes trust.",
    ],
  },
  competitor: {
    badgeClass: 'competitor',
    label: '03 · COMPETITOR / SERIAL',
    title: 'Brief, polite, factual. Then flag.',
    thai: 'ขอบคุณสำหรับความเห็นค่ะ เราตรวจสอบและไม่พบบันทึกการเข้าพักของคุณ หากเป็นความเข้าใจผิด กรุณาติดต่อเราที่ [email] โดยตรง ขอบคุณค่ะ',
    en: 'Thank you for the feedback. We checked and could not find a stay record for you. If this is a misunderstanding, please contact us directly at [email]. Thank you.',
    why: "Future readers learn one thing: the owner couldn't verify the stay. You're not arguing — you're recording a fact. Then file a Google flag with your booking records as proof.",
    dont: [
      'Accusing them of being a competitor in public — even if true, you look paranoid.',
      'A long reply matching their tone — gives the review more visual weight in search results.',
    ],
  },
  extortion: {
    badgeClass: 'extortion',
    label: '04 · EXTORTION POSSIBLE',
    title: 'Document everything. Then evaluate.',
    thai: 'ขอบคุณสำหรับข้อความค่ะ เรากำลังตรวจสอบรายละเอียดของการเข้าพักนี้และจะติดต่อคุณผ่าน [email] โดยตรงเร็วๆ นี้ค่ะ — [your name]',
    en: 'Thank you for your message. We are checking the details of this stay and will contact you directly at [email] shortly. — [your name]',
    why: "You've created a paper trail showing you tried to handle it via legitimate channels. That matters when you file the Google report. Never reply to the demand privately.",
    dont: [
      'Sending the discount or comp they asked for — pays one, attracts ten more.',
      'Replying angrily in public — gives them ammunition for the next review or screenshot.',
    ],
  },
};

const NODES = {
  Q1: {
    num: 'QUESTION 1 OF 2',
    text: "When you read the review, what's your gut reaction?",
    opts: [
      { key: 'A', text: 'Honestly — they have a point. Something went wrong.', next: 'Q2A' },
      { key: 'B', text: "This is unfair. I don't even remember this guest.", next: 'Q2B' },
    ],
  },
  Q2A: {
    num: 'QUESTION 2 OF 2',
    text: 'Can you specifically address what went wrong?',
    opts: [
      { key: 'A', text: "Yes — I know exactly what they're describing.", next: 'R:specific' },
      { key: 'B', text: 'Sort of — we have a general issue here.', next: 'R:pattern' },
    ],
  },
  Q2B: {
    num: 'QUESTION 2 OF 2',
    text: "Look at the reviewer's profile. What do you see?",
    opts: [
      { key: 'A', text: 'Multiple negative reviews of similar businesses, no positive ones.', next: 'R:competitor' },
      { key: 'B', text: 'Mostly positive reviews elsewhere — this is an outlier.', next: 'R:extortion' },
      { key: 'C', text: 'Brand new account. This is their first review.', next: 'R:extortion' },
    ],
  },
};

const REF_CARDS = [
  { cls: 'specific', num: '01', label: 'LEGITIMATE · SPECIFIC', title: 'Specific acknowledgment + concrete action.', approach: "Name the issue. Name the fix. Name the date. Don't apologize for things you didn't do." },
  { cls: 'pattern', num: '02', label: 'LEGITIMATE · PATTERN', title: 'Acknowledge the pattern, take it offline.', approach: "Don't deny it in public. Don't promise a fix you can't ship. Invite a direct conversation." },
  { cls: 'competitor', num: '03', label: 'COMPETITOR / SERIAL', title: 'Brief, polite, factual. Then flag.', approach: "One sentence, no engagement with the false claim. Then report it through Google's flow." },
  { cls: 'extortion', num: '04', label: 'EXTORTION POSSIBLE', title: 'Document everything. Then evaluate.', approach: "Screenshot, save messages, report. Don't reply privately to demands. Reply publicly in template 03." },
];

function Question({ node, chosenKey, onChoose, frozen }) {
  return (
    <div className="osp-q">
      <div className="osp-q-head">
        <span className="osp-q-num">{node.num}</span>
      </div>
      <h3 className="osp-q-text">{node.text}</h3>
      <div className={`osp-opts${node.opts.length === 3 ? ' three' : ''}`}>
        {node.opts.map((o) => {
          const isChosen = chosenKey === o.key;
          const isDim = frozen && !isChosen;
          return (
            <button
              key={o.key}
              type="button"
              className={`osp-opt${isChosen ? ' chosen' : ''}${isDim ? ' dim' : ''}`}
              onClick={() => !frozen && onChoose(o)}
              disabled={frozen}
            >
              <span className="osp-opt-key">{o.key}</span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ result, onRestart }) {
  return (
    <div className="osp-result">
      <div className="osp-result-top">
        <div className="osp-result-lab">
          <span className={`osp-badge ${result.badgeClass}`}>{result.label}</span>
          <h3>{result.title}</h3>
        </div>
        <button type="button" className="osp-restart" onClick={onRestart}>
          ← START OVER
        </button>
      </div>
      <div className="osp-result-body">
        <div className="osp-r-block">
          <div className="osp-h reply">WHAT TO REPLY</div>
          <div className="osp-reply-card">
            <div className="osp-thai-line">{result.thai}</div>
            <div className="osp-en-line">{result.en}</div>
          </div>
        </div>
        <div className="osp-r-block">
          <div className="osp-h why">WHY THIS WORKS</div>
          <p className="osp-why-text">{result.why}</p>
        </div>
        <div className="osp-r-block">
          <div className="osp-h not">WHAT NOT TO SAY</div>
          <ul className="osp-dont-list">
            {result.dont.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="osp-result-inline-cta">
          <Link
            to={`/audit?from=one-star-playbook-${result.badgeClass}`}
            className="plausible-event-name=PlaybookResultCtaClick"
          >
            Want this drafted for YOUR review? →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function OneStarPlaybook() {
  const { lang } = useI18n();
  const isThai = lang === 'th';

  usePageTitle(isThai ? 'รับมือรีวิว 1 ดาว — Playbook ฟรี · ReviewHub' : 'The 1-Star Playbook — free decision tree · ReviewHub');
  useSocialMeta({
    title: isThai ? 'รับมือรีวิว 1 ดาวอย่างถูกต้อง' : "You just got a 1-star review. Don't reply yet.",
    description: 'Free decision tree for Bangkok hospitality owners. Figure out what kind of 1-star you have, then use the right reply template. Thai + English.',
  });

  // history: list of { nodeKey, chosenKey } turns + optional result key
  const [history, setHistory] = useState([{ nodeKey: 'Q1' }]);

  const onChoose = useCallback((turnIndex, opt) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, turnIndex + 1).map((t, i) =>
        i === turnIndex ? { ...t, chosenKey: opt.key } : t,
      );
      if (opt.next.startsWith('R:')) {
        trimmed.push({ resultKey: opt.next.slice(2) });
      } else {
        trimmed.push({ nodeKey: opt.next });
      }
      return trimmed;
    });
  }, []);

  const restart = useCallback(() => {
    setHistory([{ nodeKey: 'Q1' }]);
  }, []);

  return (
    <div className="osp-page">
      <MarketingNav />

      <main className="osp-main">
        <section className="osp-hero">
          <div className="osp-eye">FOR BANGKOK HOSPITALITY OWNERS</div>
          <h1 className="osp-h1">
            You just got a 1-star review.
            <br />
            <span className="osp-h1-em">Don't reply yet.</span>
          </h1>
          <p className="osp-lede">
            First — figure out what KIND of 1-star this actually is. The reply that
            works for a legitimate complaint will make things worse on a competitor's
            drive-by. Two minutes here saves you from making a 1-star into a 1-star saga.
          </p>
          <div className="osp-by">BY EARTH · SOLO FOUNDER · BANGKOK</div>
        </section>

        <section className="osp-tree">
          {history.map((turn, i) => {
            if (turn.resultKey) {
              return <ResultCard key={`r-${i}`} result={RESULTS[turn.resultKey]} onRestart={restart} />;
            }
            const frozen = i < history.length - 1;
            return (
              <Question
                key={`q-${turn.nodeKey}-${i}`}
                node={NODES[turn.nodeKey]}
                chosenKey={turn.chosenKey}
                frozen={frozen}
                onChoose={(opt) => onChoose(i, opt)}
              />
            );
          })}
        </section>

        <details className="osp-expand">
          <summary>
            <span>What if they're asking for a discount or free service to remove it?</span>
            <span className="osp-chev">EXPAND →</span>
          </summary>
          <div className="osp-expand-panel">
            <p>
              This is extortion, and it's against Google's policies. Don't engage
              privately, don't pay. Build a paper trail and report.
            </p>
            <div className="osp-eye osp-eye-rose">RED FLAGS</div>
            <ul className="osp-bul">
              <li>Vague review with no specific incident details</li>
              <li>Private message offering to "remove the review" for a refund, free night, or comp</li>
              <li>Reviewer has a thin profile with similar tactics on other businesses</li>
              <li>The "stay" date doesn't match any booking in your PMS</li>
            </ul>
            <div className="osp-eye">WHAT TO DO</div>
            <ul className="osp-bul">
              <li>Screenshot the review, the profile, and any private messages — timestamps matter</li>
              <li>Report via Google Business Profile → Reviews → flag → "Conflict of interest / extortion"</li>
              <li>In Thailand, you can also report via LINE Channel's official business support if the threat came through LINE</li>
              <li>Reply publicly using the COMPETITOR/SERIAL template above — brief, factual, never engage the demand</li>
            </ul>
          </div>
        </details>

        <section className="osp-refsec">
          <div className="osp-eye">QUICK REFERENCE</div>
          <h2 className="osp-h2">The four 1-stars, at a glance.</h2>
          <div className="osp-ref-grid">
            {REF_CARDS.map((c) => (
              <div key={c.num} className={`osp-ref-card ${c.cls}`}>
                <span className="osp-ref-num">{c.num}</span>
                <div className="osp-ref-label">{c.label}</div>
                <h4>{c.title}</h4>
                <p className="osp-ref-approach">{c.approach}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="osp-cta">
          <div className="osp-eye osp-eye-cta">A SOFT ASK · NO SPAM</div>
          <h2 className="osp-cta-h">This was a free playbook. Need it for THIS review?</h2>
          <p className="osp-cta-sub">Paste your review and we'll draft a reply in Thai + your customer's language, free.</p>
          <Link
            to="/audit?from=one-star-playbook"
            className="osp-cta-btn plausible-event-name=PlaybookToAuditClick"
          >
            Draft my reply →
          </Link>
          <p className="osp-cta-foot">I'm Earth — solo founder in Bangkok. I'll never spam your inbox.</p>
        </section>
      </main>

      <MarketingFooter />

      <style>{`
        .osp-page {
          background: var(--rh-paper, #fbf8f1);
          color: var(--rh-ink, #1d242c);
          min-height: 100vh;
          font-family: Inter, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        .osp-main { max-width: 920px; margin: 0 auto; padding: 0 24px; }

        .osp-eye {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: var(--rh-ochre-deep, #a07d20);
        }
        .osp-eye-rose { color: var(--rh-rose, #c2566c); }
        .osp-eye-cta { color: #e7c992; }

        .osp-hero { padding: 56px 0 32px; }
        .osp-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400;
          letter-spacing: -.015em;
          line-height: 1.05;
          font-size: clamp(40px, 6vw, 64px);
          margin: 18px 0 0;
        }
        .osp-h1-em { font-style: italic; color: var(--rh-teal, #1e4d5e); }
        .osp-lede {
          font-size: 18px;
          line-height: 1.6;
          color: var(--rh-ink-soft, #4a525a);
          max-width: 640px;
          margin: 22px 0 0;
          text-wrap: pretty;
        }
        .osp-by {
          margin-top: 28px;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 600;
          letter-spacing: .14em;
          color: var(--rh-ink-mute, #7a818a);
          text-transform: uppercase;
        }

        .osp-tree { padding: 16px 0 24px; }
        .osp-q { padding: 22px 0 0; animation: ospIn .3s ease; }
        @keyframes ospIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .osp-q-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
        .osp-q-num {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; font-weight: 600; letter-spacing: .14em;
          color: var(--rh-ochre-deep, #a07d20); text-transform: uppercase;
        }
        .osp-q-text {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(22px, 3vw, 28px);
          line-height: 1.25;
          margin: 0 0 16px;
          letter-spacing: -.005em;
        }
        .osp-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .osp-opts.three { grid-template-columns: 1fr; }
        @media (min-width: 720px) { .osp-opts.three { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 600px) { .osp-opts { grid-template-columns: 1fr; } }
        .osp-opt {
          background: #fff;
          border: 1px solid rgba(29,36,44,.10);
          border-radius: 12px;
          padding: 16px 18px;
          text-align: left;
          font: inherit;
          font-size: 15px;
          line-height: 1.45;
          color: var(--rh-ink, #1d242c);
          cursor: pointer;
          transition: border-color .15s, transform .15s, background .15s;
          display: flex; align-items: flex-start; gap: 12px;
          min-height: 70px;
        }
        .osp-opt:hover:not(:disabled) { border-color: var(--rh-teal, #1e4d5e); transform: translateY(-1px); }
        .osp-opt:disabled { cursor: default; }
        .osp-opt.dim { opacity: .38; }
        .osp-opt.chosen { border-color: var(--rh-teal, #1e4d5e); background: #e3ecef; }
        .osp-opt-key {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px; font-weight: 600; letter-spacing: .14em;
          color: var(--rh-ochre-deep, #a07d20);
          flex-shrink: 0; padding-top: 3px; width: 18px;
        }
        .osp-opt.chosen .osp-opt-key { color: var(--rh-teal, #1e4d5e); }

        .osp-result {
          margin-top: 28px;
          background: #fff;
          border: 1px solid rgba(29,36,44,.10);
          border-radius: 14px;
          overflow: hidden;
          animation: ospIn .35s ease;
        }
        .osp-result-top {
          padding: 18px 22px;
          border-bottom: 1px solid rgba(29,36,44,.10);
          display: flex; align-items: center; gap: 14px;
          justify-content: space-between; flex-wrap: wrap;
        }
        .osp-result-lab { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .osp-result-top h3 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400; font-size: 22px; margin: 0;
          letter-spacing: -.005em;
        }
        .osp-badge {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase; padding: 4px 8px; border-radius: 3px;
        }
        .osp-badge.specific { color: var(--rh-sage, #6b8e7a); background: #e9efea; }
        .osp-badge.pattern { color: var(--rh-ochre-deep, #a07d20); background: #fdf6e7; }
        .osp-badge.competitor { color: var(--rh-rose, #c2566c); background: #fbe9ec; }
        .osp-badge.extortion { color: #8a3344; background: #fbe9ec; }
        .osp-restart {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px; font-weight: 600; letter-spacing: .12em;
          color: var(--rh-ink-soft, #4a525a);
          background: transparent; border: 0; cursor: pointer;
          text-transform: uppercase;
        }
        .osp-restart:hover { color: var(--rh-teal, #1e4d5e); }
        .osp-result-body { padding: 22px; }
        .osp-r-block { margin-bottom: 20px; }
        .osp-r-block:last-child { margin-bottom: 0; }
        .osp-h {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase; margin-bottom: 10px;
        }
        .osp-h.reply { color: var(--rh-ochre-deep, #a07d20); }
        .osp-h.why { color: var(--rh-sage, #6b8e7a); }
        .osp-h.not { color: var(--rh-rose, #c2566c); }
        .osp-reply-card {
          background: var(--rh-paper, #fbf8f1);
          border-left: 3px solid var(--rh-ochre-deep, #a07d20);
          padding: 14px 18px;
          border-radius: 0 8px 8px 0;
        }
        .osp-thai-line {
          font-family: 'Noto Sans Thai', 'Sarabun', system-ui, sans-serif;
          font-size: 15.5px; line-height: 1.7;
          color: var(--rh-ink, #1d242c);
          text-wrap: pretty;
        }
        .osp-en-line {
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic; font-size: 14px; line-height: 1.55;
          color: var(--rh-ink-soft, #4a525a);
          margin-top: 10px; padding-top: 10px;
          border-top: 1px dashed rgba(29,36,44,.10);
        }
        .osp-why-text { font-size: 14.5px; line-height: 1.55; max-width: 620px; margin: 0; }
        .osp-dont-list { margin: 0; padding: 0; list-style: none; }
        .osp-dont-list li {
          padding: 8px 0 8px 22px;
          font-size: 14px; line-height: 1.5;
          position: relative;
        }
        .osp-dont-list li::before {
          content: "✕";
          position: absolute; left: 0; top: 8px;
          color: var(--rh-rose, #c2566c);
          font-size: 13px; font-weight: 600;
        }
        .osp-result-inline-cta {
          margin-top: 22px;
          padding-top: 16px;
          border-top: 1px dashed rgba(29,36,44,.10);
        }
        .osp-result-inline-cta a {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 17px;
          font-style: italic;
          color: var(--rh-teal, #1e4d5e);
          text-decoration: none;
          border-bottom: 1px solid rgba(30,77,94,.3);
          letter-spacing: -.005em;
        }
        .osp-result-inline-cta a:hover {
          color: var(--rh-teal-deep, #163d4a);
          border-color: var(--rh-teal-deep, #163d4a);
        }

        .osp-expand {
          margin: 32px 0 0;
          border: 1px solid rgba(29,36,44,.10);
          border-radius: 12px;
          background: #fff;
          overflow: hidden;
        }
        .osp-expand summary {
          cursor: pointer;
          padding: 18px 22px;
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 19px; letter-spacing: -.005em;
          list-style: none;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
        }
        .osp-expand summary::-webkit-details-marker { display: none; }
        .osp-chev {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 11px; font-weight: 600; letter-spacing: .14em;
          color: var(--rh-ochre-deep, #a07d20);
          transition: transform .2s;
          flex-shrink: 0;
        }
        .osp-expand[open] .osp-chev { transform: rotate(90deg); }
        .osp-expand-panel {
          padding: 0 22px 22px;
          border-top: 1px solid rgba(29,36,44,.10);
          padding-top: 18px;
        }
        .osp-expand-panel p { font-size: 14.5px; line-height: 1.6; color: var(--rh-ink-soft, #4a525a); margin: 0 0 12px; }
        .osp-bul { padding: 0; list-style: none; margin: 12px 0 14px; }
        .osp-bul li {
          padding: 7px 0 7px 22px;
          position: relative;
          font-size: 14.5px; line-height: 1.5;
        }
        .osp-bul li::before {
          content: "";
          position: absolute; left: 0; top: 14px;
          width: 10px; height: 1px;
          background: var(--rh-rose, #c2566c);
        }

        .osp-refsec { padding: 56px 0 16px; }
        .osp-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(26px, 4vw, 36px);
          font-weight: 400;
          letter-spacing: -.01em;
          margin: 12px 0 24px;
        }
        .osp-ref-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        @media (max-width: 600px) { .osp-ref-grid { grid-template-columns: 1fr; } }
        .osp-ref-card {
          background: #fff;
          border: 1px solid rgba(29,36,44,.10);
          border-radius: 12px;
          padding: 20px 22px;
        }
        .osp-ref-num {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 36px;
          color: var(--rh-ochre-deep, #a07d20);
          line-height: 1;
          letter-spacing: -.01em;
          float: right;
        }
        .osp-ref-label {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10.5px; font-weight: 600; letter-spacing: .14em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .osp-ref-card.specific .osp-ref-label { color: var(--rh-sage, #6b8e7a); }
        .osp-ref-card.pattern .osp-ref-label { color: var(--rh-ochre-deep, #a07d20); }
        .osp-ref-card.competitor .osp-ref-label { color: var(--rh-rose, #c2566c); }
        .osp-ref-card.extortion .osp-ref-label { color: #8a3344; }
        .osp-ref-card h4 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400; font-size: 21px;
          letter-spacing: -.005em;
          margin: 0 0 10px;
        }
        .osp-ref-approach { font-size: 14.5px; line-height: 1.55; color: var(--rh-ink-soft, #4a525a); margin: 0; }

        .osp-cta {
          margin: 40px 0 64px;
          background: var(--rh-teal, #1e4d5e);
          color: #fbf8f1;
          border-radius: 18px;
          padding: 36px 36px;
          position: relative;
          overflow: hidden;
        }
        .osp-cta::after {
          content: "";
          position: absolute; right: -60px; top: -60px;
          width: 240px; height: 240px; border-radius: 50%;
          background: radial-gradient(circle, rgba(192,138,62,.25), transparent 65%);
          pointer-events: none;
        }
        .osp-cta-h {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400; font-size: clamp(22px, 3.5vw, 28px);
          letter-spacing: -.01em;
          margin: 10px 0 6px;
          color: #fbf8f1;
          position: relative; z-index: 2;
        }
        .osp-cta-sub {
          font-size: 14.5px;
          color: rgba(251,248,241,.78);
          line-height: 1.55;
          max-width: 520px; margin: 0 0 20px;
          position: relative; z-index: 2;
        }
        .osp-cta-btn {
          display: inline-block;
          background: #e7c992;
          color: #163d4a;
          border: 0;
          border-radius: 8px;
          padding: 12px 20px;
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 14px;
          letter-spacing: -.005em;
          text-decoration: none;
          transition: background .15s;
          position: relative; z-index: 2;
        }
        .osp-cta-btn:hover { background: #fbf8f1; }
        .osp-cta-foot {
          margin-top: 22px;
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic;
          font-size: 15px;
          color: rgba(251,248,241,.7);
          position: relative; z-index: 2;
        }
      `}</style>
    </div>
  );
}
