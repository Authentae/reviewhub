import Script from 'next/script';
import { env } from '@/lib/env';

export function Analytics() {
  const ga4 = env.ga4Id();
  const plausible = env.plausibleDomain();

  return (
    <>
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga4}', { anonymize_ip: true });
          `}</Script>
        </>
      )}
      {plausible && (
        <Script
          src="https://plausible.io/js/script.js"
          data-domain={plausible}
          strategy="afterInteractive"
          defer
        />
      )}
    </>
  );
}

export function AdsenseLoader() {
  const client = env.adsense.clientId();
  if (!client) return null;
  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
