import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import Navbar from '../components/Navbar';
import { useToast } from '../components/Toast';
import usePageTitle from '../hooks/usePageTitle';

// /outbound-audits — founder-only tool for the demo-first outreach
// loop. Paste a prospect's business name + their last 5–10 reviews,
// hit Generate, get a shareable URL to DM them. Below the form: a
// list of recent audits with view-count + opened-at so the founder
// knows which prospects actually opened the link.
//
// Workflow:
//   1. Open prospect's Google profile in a tab
//   2. Copy 5–10 of their public reviews (one per row in textarea)
//   3. Type their business name + paste reviews here
//   4. Hit Generate (90 sec to draft 10 replies)
//   5. Copy the share URL, paste into a DM
//   6. Watch the audits-list to see who opened
//
// Each generated audit costs N AI-draft slots from the founder's
// account quota. Free-tier founders trying outreach hit their 3/mo
// cap fast — that's the upgrade pressure on the founder, not abuse
// prevention.
export default function OutboundAudits() {
  const toast = useToast();
  usePageTitle('Outbound audits · ReviewHub');

  const [businessName, setBusinessName] = useState('');
  const [reviewsText, setReviewsText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [audits, setAudits] = useState([]);
  const [copiedToken, setCopiedToken] = useState(null);

  function loadAudits() {
    api.get('/audit-previews')
      .then(({ data }) => setAudits(data.audits || []))
      .catch(() => { /* non-fatal */ });
  }

  useEffect(() => { loadAudits(); }, []);

  // Parse the reviews textarea into structured rows. The founder pastes
  // in this format (one review per block, blank line between):
  //
  //   Alice 5
  //   Great food, super friendly staff
  //
  //   Bob 2
  //   Wait was 30 minutes, no apology
  //
  // First line = "<reviewer name> <rating>", subsequent lines until
  // blank = review body. Forgiving parser — if the rating is missing,
  // default 5. If reviewer name is missing, "Anonymous".
  function parseReviews(text) {
    const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const reviews = [];
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim()).filter((l) => l !== '');
      if (lines.length === 0) continue;
      const header = lines[0];
      const body = lines.slice(1).join('\n').trim();
      // Header format: "Name 5" or "Name (5 stars)" or just "Name"
      const ratingMatch = header.match(/(\d)\s*(?:stars?|★|\*)?\s*$/i);
      const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 5;
      const reviewer_name = header.replace(/(\d)\s*(?:stars?|★|\*)?\s*$/i, '').trim() || 'Anonymous';
      const text = body || header; // if no body, treat whole block as text
      // Skip if header looked like the body — meaning no real header was provided
      if (!body && !ratingMatch) {
        reviews.push({ reviewer_name: 'Anonymous', rating: 5, text: header });
      } else {
        reviews.push({ reviewer_name, rating, text });
      }
    }
    return reviews;
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!businessName.trim()) {
      toast('Business name is required', 'error');
      return;
    }
    const reviews = parseReviews(reviewsText);
    if (reviews.length === 0) {
      toast('Paste at least one review', 'error');
      return;
    }
    if (reviews.length > 12) {
      toast('Max 12 reviews per audit — pick the most-recent or most-painful ones', 'error');
      return;
    }

    setGenerating(true);
    setLastResult(null);
    try {
      const { data } = await api.post('/audit-previews', {
        business_name: businessName.trim(),
        reviews,
      });
      setLastResult(data);
      // Clear the form so the next outreach starts fresh
      setBusinessName('');
      setReviewsText('');
      loadAudits();
      toast(`Audit ready — ${data.reviews.filter((r) => r.draft).length} drafts`, 'success');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not generate audit';
      const upgradeTo = err?.response?.data?.upgradeTo;
      if (upgradeTo) {
        toast(`${msg} — upgrade to ${upgradeTo} for unlimited drafts`, 'error');
      } else {
        toast(msg, 'error');
      }
    } finally {
      setGenerating(false);
    }
  }

  async function copyShareUrl(url, token) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast('Could not copy. Select and copy manually.', 'error');
    }
  }

  async function handleMarkReplied(id) {
    // Suppresses the 48h follow-up reminder for this audit. Idempotent
    // server-side, so a misclick on an already-marked row is harmless.
    try {
      await api.post(`/audit-previews/${id}/mark-replied`);
      toast('Marked as replied — follow-up reminder suppressed.', 'success');
      loadAudits();
    } catch {
      toast('Could not mark as replied', 'error');
    }
  }

  async function handleRevoke(id) {
    if (!confirm('Revoke this share URL? The prospect will get a 404 if they open it.')) return;
    try {
      await api.delete(`/audit-previews/${id}`);
      toast('Audit revoked', 'info');
      loadAudits();
    } catch {
      toast('Could not revoke', 'error');
    }
  }

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Outbound audits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generate a demo-first audit URL to DM a prospect. Paste their
            business name + 5–10 of their public Google reviews, get a
            shareable preview URL back. See the{' '}
            <a
              href="https://github.com/Authentae/reviewhub/blob/main/docs/skills/audit-outreach.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              outreach playbook
            </a>{' '}
            for what to send next.
          </p>
        </header>

        {/* Generator form */}
        <section className="card p-5">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label htmlFor="biz-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Prospect's business name
              </label>
              <input
                id="biz-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Roast8ry Bangkok"
                className="input text-sm w-full"
                maxLength={200}
                required
              />
            </div>

            <div>
              <label htmlFor="reviews-text" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                Paste their reviews
              </label>
              <textarea
                id="reviews-text"
                value={reviewsText}
                onChange={(e) => setReviewsText(e.target.value)}
                placeholder={`Format: "Name Rating" on the first line, review body below, blank line between reviews.

Alice 5
Great coffee, friendly staff. The pour-over was excellent.

Bob 2
Waited 30 minutes for a flat white. No apology.

Mali 4
ร้านน่ารัก กาแฟดี แต่ที่นั่งน้อย`}
                rows={12}
                className="input text-sm w-full font-mono"
                required
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Mix languages freely — the AI matches the language of each review automatically.
              </p>
            </div>

            <button
              type="submit"
              disabled={generating}
              aria-busy={generating}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {generating ? 'Generating drafts… (≈90 sec for 10 reviews)' : 'Generate audit'}
            </button>
          </form>
        </section>

        {/* Last result — share URL prominently displayed */}
        {lastResult && (
          <section
            className="rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-5"
            role="status"
          >
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
              ✓ Audit ready for {lastResult.business_name}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-200 mb-3">
              {lastResult.reviews.filter((r) => r.draft).length} of {lastResult.reviews.length} drafts generated.
              Share URL below — paste it into the prospect's DM.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-700 rounded p-2 break-all text-gray-800 dark:text-gray-100">
                {lastResult.share_url}
              </code>
              <button
                type="button"
                onClick={() => copyShareUrl(lastResult.share_url, lastResult.share_token)}
                className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
              >
                {copiedToken === lastResult.share_token ? '✓ Copied' : 'Copy URL'}
              </button>
              <Link
                to={`/audit-preview/${lastResult.share_token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
              >
                Preview
              </Link>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-200 mt-3">
              Link expires in 30 days. View count appears in the list below once the prospect opens it.
            </p>
          </section>
        )}

        {/* History — recent audits with view stats */}
        {audits.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Recent audits ({audits.length})
            </h2>
            <ul className="space-y-2">
              {audits.map((a) => {
                const opened = a.view_count > 0;
                const expiresIn = Math.max(0, Math.round(
                  (new Date(a.expires_at + 'Z').getTime() - Date.now()) / 86400000
                ));
                return (
                  <li
                    key={a.id}
                    className="card p-3 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {a.business_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>
                          {opened ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Opened {a.view_count}× · last {new Date(a.last_viewed_at + 'Z').toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Not opened yet</span>
                          )}
                        </span>
                        <span>·</span>
                        <span>{expiresIn}d left</span>
                        {a.marked_as_replied_at && (
                          <>
                            <span>·</span>
                            <span className="text-blue-500 dark:text-blue-400">Replied ✓</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => copyShareUrl(a.share_url, a.share_token)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        {copiedToken === a.share_token ? '✓' : 'Copy URL'}
                      </button>
                      <Link
                        to={`/audit-preview/${a.share_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        View
                      </Link>
                      {opened && !a.marked_as_replied_at && (
                        <button
                          type="button"
                          onClick={() => handleMarkReplied(a.id)}
                          className="text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Suppresses the 48h follow-up reminder"
                        >
                          Replied ✓
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRevoke(a.id)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
