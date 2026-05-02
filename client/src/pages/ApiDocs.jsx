import React from 'react';
import { Link } from 'react-router-dom';
import MarketingNav from '../components/MarketingNav';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// /api-docs — public reference for the Business-plan API. Created
// because tech-savvy buyers (agencies, ops managers, indie devs)
// asked "where are the API docs?" in persona testing. Without public
// docs, "API access" on the pricing card reads as marketing fluff.
//
// This page is intentionally a TL;DR + curl examples, not a full
// OpenAPI spec. Full reference can come later; today the goal is to
// prove the API exists and works without making the buyer sign a
// contract first.
export default function ApiDocs() {
  const { t, lang } = useI18n();
  usePageTitle(t('apiDocs.title', 'API Reference · ReviewHub'));
  const isThai = lang === 'th';

  return (
    <div className="rh-design rh-app min-h-screen" style={{ background: 'var(--rh-paper)' }}>
      <MarketingNav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--rh-ink)', letterSpacing: '-0.02em' }}>
          {isThai ? 'API อ้างอิง' : 'API Reference'}
        </h1>
        <p className="text-base mb-2" style={{ color: 'var(--rh-ink-soft, #4a525a)' }}>
          {isThai
            ? 'ReviewHub มี REST API สำหรับลูกค้า Business plan — รวมรีวิวและคำตอบเข้ากับเครื่องมืออื่นของคุณได้'
            : 'REST API for Business-plan customers — pull reviews, post responses, sync state into your own tooling.'}
        </p>
        <p className="text-sm mb-10" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
          {isThai
            ? 'หน้านี้คือเอกสารฉบับย่อ ถ้าต้องการ OpenAPI spec เต็ม '
            : 'This is a TL;DR + cURL examples. Need the full OpenAPI spec? '}
          <Link to="/support?type=feature" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
            {isThai ? 'ส่งคำขอมาทาง /support' : 'request via /support'}
          </Link>
          {isThai ? ' หรืออีเมล api@reviewhub.review' : ' or email api@reviewhub.review.'}
        </p>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--rh-ink)' }}>
            {isThai ? 'การยืนยันตัวตน' : 'Authentication'}
          </h2>
          <p className="mb-3 text-base" style={{ color: 'var(--rh-ink)' }}>
            {isThai
              ? 'สร้าง API key จาก Settings → API keys (ต้องเป็น Business plan) ใส่ใน header:'
              : 'Create an API key from Settings → API keys (Business plan required). Pass it in the Authorization header:'}
          </p>
          <pre style={{ background: '#1d242c', color: '#e6dfce', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
{`Authorization: Bearer rhk_live_xxxxxxxxxxxxxxxx`}
          </pre>
          <p className="mt-3 text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai
              ? 'API key ทำงานเหมือน user session — มีสิทธิ์เท่าเจ้าของบัญชี อย่าใส่ใน frontend code'
              : 'API keys carry full account-owner privileges. Never embed in frontend code. Rotate any leaked key immediately from Settings.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--rh-ink)' }}>
            {isThai ? 'ตัวอย่าง: รายการรีวิวล่าสุด' : 'Example: list recent reviews'}
          </h2>
          <pre style={{ background: '#1d242c', color: '#e6dfce', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
{`curl https://reviewhub.review/api/reviews \\
  -H "Authorization: Bearer rhk_live_xxxxxxxxxxxxxxxx"`}
          </pre>
          <p className="mt-3 text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai ? 'คืนค่า JSON: { reviews: [...], total: N }' : 'Returns JSON: { reviews: [...], total: N }'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--rh-ink)' }}>
            {isThai ? 'ตัวอย่าง: สร้างคำตอบ AI' : 'Example: draft an AI response'}
          </h2>
          <pre style={{ background: '#1d242c', color: '#e6dfce', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
{`curl https://reviewhub.review/api/reviews/{id}/draft \\
  -H "Authorization: Bearer rhk_live_xxxxxxxxxxxxxxxx"`}
          </pre>
          <p className="mt-3 text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai
              ? 'คืนค่า: { draft: "ขอบคุณค่ะ...", source: "ai" } — โควตา AI หักจากแพ็กเกจของคุณ'
              : 'Returns: { draft: "Thank you...", source: "ai" }. Counts against your monthly AI quota.'}
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--rh-ink)' }}>
            {isThai ? 'Webhook' : 'Outbound webhooks'}
          </h2>
          <p className="mb-3 text-base" style={{ color: 'var(--rh-ink)' }}>
            {isThai
              ? 'ตั้งค่า webhook URL ใน Settings เราจะ POST ไปที่ URL ของคุณเมื่อมีรีวิวใหม่ ใช้ได้กับ Zapier, Slack, n8n, Discord, etc.'
              : 'Configure a webhook URL in Settings. We POST to your URL when a new review lands. Compatible with Zapier, Slack incoming webhooks, n8n, Discord, etc.'}
          </p>
          <pre style={{ background: '#1d242c', color: '#e6dfce', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13 }}>
{`POST https://your-url.example/webhook
Content-Type: application/json
X-ReviewHub-Signature: sha256=...

{
  "event": "review.created",
  "review": {
    "id": 123,
    "platform": "google",
    "rating": 4,
    "reviewer_name": "Alice",
    "review_text": "Great food, slow service.",
    "sentiment": "neutral",
    "created_at": "2026-05-02T08:30:00Z"
  }
}`}
          </pre>
          <p className="mt-3 text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai
              ? 'ลายเซ็น HMAC SHA-256 ใน X-ReviewHub-Signature — ตรวจสอบก่อนเชื่อ payload'
              : 'HMAC SHA-256 signature in X-ReviewHub-Signature. Verify before trusting the payload (the secret is shown once when you create the webhook).'}
          </p>
          <pre style={{ background: '#1d242c', color: '#e6dfce', padding: 16, borderRadius: 8, overflowX: 'auto', fontSize: 13, marginTop: 12 }}>
{`// Node.js — verify the signature before processing
const crypto = require('crypto');

function verify(rawBody, headerValue, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(headerValue || '')
  );
}`}
          </pre>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--rh-ink)' }}>
            {isThai ? 'Rate limits' : 'Rate limits'}
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-base" style={{ color: 'var(--rh-ink)' }}>
            <li>{isThai ? 'GET endpoints: 600 ต่อนาที / API key' : 'GET endpoints: 600 per minute per API key'}</li>
            <li>{isThai ? 'POST/PUT/DELETE: 60 ต่อนาที / API key' : 'POST/PUT/DELETE: 60 per minute per API key'}</li>
            <li>{isThai ? 'AI draft endpoint: 20 ต่อนาที (หักจากโควตา AI ของคุณด้วย)' : 'AI draft endpoint: 20 per minute (also counts against your monthly AI quota)'}</li>
          </ul>
          <p className="mt-3 text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai
              ? 'เกินขีดจำกัด → 429 Too Many Requests ดู header Retry-After'
              : 'Exceed → 429 Too Many Requests with a Retry-After header. Standard exponential backoff applies.'}
          </p>
        </section>

        <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--rh-line, #e6dfce)' }}>
          <p className="text-sm" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>
            {isThai ? 'ตัวอย่างเพิ่มเติม / OpenAPI spec / Postman collection ' : 'Want more examples / OpenAPI spec / Postman collection? '}
            <Link to="/support?type=feature" style={{ color: 'var(--rh-teal-deep)', fontWeight: 600 }}>
              {isThai ? 'ขอผ่าน /support' : 'Request via /support'}
            </Link>
            {isThai ? ' — ส่งของให้ทันที (ปกติภายใน 24 ชม.)' : ' — we ship the doc you ask for, usually within 24h.'}
          </p>
          <p className="mt-4 text-sm">
            <Link to="/" style={{ color: 'var(--rh-ink-soft, #7a8189)' }}>← {isThai ? 'กลับหน้าหลัก' : 'Back to home'}</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
