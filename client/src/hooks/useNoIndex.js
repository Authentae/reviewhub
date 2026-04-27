import { useEffect } from 'react';

// Inject a `<meta name="robots" content="noindex, nofollow">` tag while the
// component is mounted, then clean up. Belt-and-braces with robots.txt — the
// disallow rule blocks crawl, this tag also tells indexers that have already
// crawled (or that ignore robots.txt) to drop the URL.
//
// Use on token-bearing or otherwise-private pages: VerifyEmail, ResetPassword,
// ForgotPassword, EmailChange, Unsubscribed, Login/MFA flow. Even though
// robots.txt disallows their paths, externally-linked URLs (e.g. someone
// pasting their reset-link on a forum) can still get into search indexes
// without the on-page meta directive.
export default function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      // Tolerate the case where the node was already removed (e.g. Hot Module
      // Replacement re-running the effect).
      if (meta.parentNode) meta.parentNode.removeChild(meta);
    };
  }, []);
}
