import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Analytics, AdsenseLoader } from '@/components/Analytics';
import { SITE_NAME, siteUrl } from '@/lib/seo';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — free tools for your money and your time`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Small, fast utility calculators for things that actually matter. RSU tax shortfalls, equity comp planning, and more — free and ad-supported.',
  applicationName: SITE_NAME,
  formatDetection: { email: false, address: false, telephone: false },
  ...(env.gscVerification()
    ? { other: { 'google-site-verification': env.gscVerification()! } }
    : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <Analytics />
        <AdsenseLoader />
      </body>
    </html>
  );
}
