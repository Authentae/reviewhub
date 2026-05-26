import type { Metadata } from 'next';
import {
  buildMetadata,
  canonical,
  faqSchema,
  howToSchema,
  webApplicationSchema,
} from '@/lib/seo';
import { JsonLd } from '@/components/JsonLd';
import { ToolShell } from '@/components/ToolShell';
import { FaqAccordion } from '@/components/FaqAccordion';
import { Disclaimer } from '@/components/Disclaimer';
import { LastUpdatedBadge } from '@/components/LastUpdatedBadge';
import { RsuShortfallCalculator } from './RsuShortfallCalculator';
import { rsuTaxShortfallContent as c } from '@/content/rsu-tax-shortfall';

export const metadata: Metadata = buildMetadata({
  slug: c.slug,
  title: c.metaTitle,
  description: c.metaDescription,
  ogImagePath: '/og-rsu-shortfall.png',
});

export default function Page() {
  const url = canonical(c.slug);

  return (
    <>
      <JsonLd
        data={webApplicationSchema({
          name: c.title,
          description: c.metaDescription,
          url,
        })}
      />
      <JsonLd
        data={howToSchema({
          name: `How to use the ${c.title}`,
          description: c.metaDescription,
          steps: [...c.howToSteps],
        })}
      />
      <JsonLd data={faqSchema([...c.faqs])} />

      <ToolShell
        title={c.h1}
        lede={c.lede}
        meta={<LastUpdatedBadge taxYear={c.taxYearDefault} isoDate={c.lastUpdated} />}
        toolUi={
          <>
            <Disclaimer />
            <RsuShortfallCalculator />
          </>
        }
        howItWorks={
          <ol className="list-decimal space-y-2 pl-5">
            {c.howToSteps.map((s) => (
              <li key={s.name}>
                <strong>{s.name}.</strong> {s.text}
              </li>
            ))}
          </ol>
        }
        faq={<FaqAccordion items={[...c.faqs]} />}
      />
    </>
  );
}
