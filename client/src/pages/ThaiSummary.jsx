import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import usePageTitle from '../hooks/usePageTitle';
import { useI18n } from '../context/I18nContext';

// Plain-Thai summary of the 6 clauses most relevant to a Thai consumer,
// written as a defensive measure against the UCTA §4 "unable to reasonably
// understand" attack on English-only Terms.
//
// Intentionally short — one page, six points, plain language. The full
// Terms in English remain the authoritative document (linked at bottom);
// this page's purpose is to demonstrate that a Thai consumer had access to
// a version they could reasonably understand. Accessed at /legal/th-summary
// and linked from the Registration form's terms checkbox for Thai users.
//
// Written in Thai deliberately without the legal register — a Thai court
// evaluating "could this consumer understand" doesn't want legal jargon,
// it wants plain language.

export default function ThaiSummary() {
  const { t } = useI18n();
  usePageTitle('สรุปข้อกำหนดสำคัญ — ReviewHub');
  const updated = '22 เมษายน 2568';

  return (
    <div className="rh-design rh-app min-h-screen">
      <Navbar />
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12" lang="th">
        <div className="rh-page-head">
          <div>
            <p className="rh-mono" style={{ fontSize: 11, color: 'var(--rh-ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              TH · สรุป
            </p>
            <h1>สรุปข้อกำหนดสำคัญ (ภาษาไทย)</h1>
            <p className="rh-page-sub">อัปเดตล่าสุด: {updated}</p>
          </div>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-8">
          หน้านี้สรุปประเด็นสำคัญ 6 ข้อจากข้อกำหนดการใช้บริการฉบับเต็มภาษาอังกฤษ
          <strong> ฉบับภาษาอังกฤษคือเอกสารหลักตามกฎหมาย </strong>
          หากข้อมูลในหน้านี้ขัดแย้งกับฉบับภาษาอังกฤษ ให้ยึดฉบับภาษาอังกฤษเป็นหลัก
        </p>

        <article className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-gray-700 dark:text-gray-300">
          {/* 1. Free tier and refunds */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              1. การสมัครและการคืนเงิน
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>เริ่มใช้งาน<strong>ฟรี</strong>ได้ โดยไม่ต้องใช้บัตรเครดิต (แผน Free)</li>
              <li>หากอัปเกรดเป็นแพ็กเกจเสียเงิน <strong>รับประกันคืนเงินภายใน 30 วัน</strong> สำหรับเดือนแรก</li>
              <li>หลังเดือนแรก ยกเลิกได้ตลอดเวลา ใช้บริการได้จนสิ้นรอบบิลที่ชำระแล้ว แต่ <strong>ไม่คืนเงินบางส่วน</strong> สำหรับรอบบิลนั้น</li>
              <li>หากเราเรียกเก็บเงินผิด หรือบริการขัดข้องเป็นเวลานาน <strong>เราจะคืนเงิน</strong> ให้</li>
            </ul>
          </section>

          {/* 2. What we do with your data */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              2. ข้อมูลของคุณ
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>เราเก็บ: อีเมล รหัสผ่านที่เข้ารหัสแล้ว ข้อมูลธุรกิจ และรีวิวจากแพลตฟอร์มที่คุณเชื่อมต่อ</li>
              <li>เรา<strong>ไม่ขาย</strong>ข้อมูลของคุณ</li>
              <li>เรา<strong>ไม่ใช้</strong>ข้อมูลของคุณเพื่อฝึก AI</li>
              <li>คุณสามารถดาวน์โหลดข้อมูลทั้งหมดได้ที่ "การตั้งค่า → ข้อมูลของคุณ"</li>
              <li>คุณสามารถลบบัญชีและข้อมูลทั้งหมดได้ที่ "การตั้งค่า → โซนอันตราย"</li>
              <li>เราปฏิบัติตาม<strong>พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</strong></li>
            </ul>
          </section>

          {/* 3. AI-drafted responses */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              3. คำตอบที่ร่างโดย AI
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>AI ช่วยร่างคำตอบรีวิว แต่ <strong>เป็นเพียงข้อเสนอแนะ</strong> ไม่ใช่คำตอบสำเร็จรูป</li>
              <li>คุณต้อง<strong>อ่านและตรวจสอบ</strong>ก่อนโพสต์ทุกครั้ง</li>
              <li>เมื่อคุณโพสต์คำตอบ <strong>คุณคือผู้เผยแพร่</strong> และรับผิดชอบในเนื้อหานั้น</li>
              <li>เรา<strong>ไม่รับผิดชอบ</strong>หากคุณโพสต์คำตอบจาก AI ที่ผิดพลาดหรือไม่เหมาะสมโดยไม่ได้ตรวจสอบ</li>
            </ul>
          </section>

          {/* 4. What you can't do */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              4. สิ่งที่คุณทำไม่ได้ (นโยบายการใช้งาน)
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>ห้ามใช้บริการเพื่อ<strong>สร้างรีวิวปลอม</strong> ซื้อ-ขายรีวิว หรือจ่ายเงินแลกรีวิว</li>
              <li>ต้องเชื่อมต่อเฉพาะธุรกิจที่คุณ<strong>เป็นเจ้าของหรือมีอำนาจจัดการ</strong></li>
              <li>ต้องปฏิบัติตามข้อกำหนดของแพลตฟอร์มรีวิวที่เชื่อมต่อ (Google, Yelp, Facebook ฯลฯ)</li>
              <li>ห้ามใช้บริการเพื่อคุกคาม หมิ่นประมาท หรือเปิดเผยข้อมูลส่วนตัวของผู้รีวิว</li>
              <li>การละเมิดอาจทำให้บัญชีถูกระงับ<strong>ทันทีโดยไม่คืนเงิน</strong></li>
            </ul>
          </section>

          {/* 5. Limitation of liability */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              5. ขอบเขตความรับผิดของเรา
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>เราพยายามทำบริการให้ดีที่สุด แต่<strong>ไม่รับประกันว่าบริการจะไม่มีข้อผิดพลาด</strong>หรือพร้อมใช้ 100%</li>
              <li>
                หากคุณเสียหายจากการใช้บริการ ความรับผิดของเราไม่เกิน
                <strong>ค่าบริการที่คุณจ่ายให้เราใน 12 เดือนที่ผ่านมา</strong>
              </li>
              <li>
                <strong>ข้อยกเว้น</strong> ข้อจำกัดข้างต้นไม่ใช้กับกรณี:
                <ul className="list-disc ml-5 space-y-0.5 mt-1">
                  <li>การกระทำโดยจงใจ (เจตนา)</li>
                  <li>ความประมาทเลินเล่ออย่างร้ายแรง</li>
                  <li>การฉ้อโกง</li>
                  <li>สิทธิคุ้มครองผู้บริโภคตามพ.ร.บ. คุ้มครองผู้บริโภค พ.ศ. 2522</li>
                </ul>
              </li>
              <li>เรา<strong>ไม่รับผิดชอบ</strong>สำหรับการกระทำของแพลตฟอร์มภายนอก (Google/Yelp/Facebook ฯลฯ) หรือการเปลี่ยนแปลง API ของพวกเขา</li>
            </ul>
          </section>

          {/* 6. Disputes */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              6. การระงับข้อพิพาทและกฎหมายที่ใช้
            </h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>หากมีข้อพิพาท กรุณาติดต่อเราที่ <strong>support@reviewhub.review</strong> ก่อน เรายินดีแก้ไขโดยไม่ต้องฟ้องศาล</li>
              <li>หากต้องดำเนินคดี ข้อกำหนดฉบับเต็มระบุให้ใช้<strong>อนุญาโตตุลาการแบบรายบุคคล</strong> (ดูข้อ §10 ฉบับอังกฤษ)</li>
              <li>อย่างไรก็ตาม <strong>สิทธิของคุณตามกฎหมายไทยที่คุ้มครองผู้บริโภค</strong> (พ.ร.บ. คุ้มครองผู้บริโภค, พ.ร.บ. ว่าด้วยข้อสัญญาที่ไม่เป็นธรรม) <strong>ยังคงมีผลเต็มที่</strong> และไม่ถูกตัดทอนโดยข้อกำหนดนี้</li>
              <li>คุณสามารถ<strong>ร้องเรียนได้ที่สำนักงานคณะกรรมการคุ้มครองผู้บริโภค (สคบ.)</strong> ได้ตามปกติ</li>
            </ul>
          </section>

          <section className="border-t pt-6 mt-8">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              อ่านฉบับเต็ม
            </h2>
            <p>
              เอกสารฉบับเต็มภาษาอังกฤษ ซึ่งเป็นเอกสารตามกฎหมาย:
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li><Link to="/terms" className="text-blue-600 hover:underline">Terms of Service</Link> — ข้อกำหนดการใช้บริการ</li>
              <li><Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> — นโยบายความเป็นส่วนตัว (PDPA)</li>
              <li><Link to="/acceptable-use" className="text-blue-600 hover:underline">Acceptable Use Policy</Link> — นโยบายการใช้งาน</li>
              <li><Link to="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</Link> — นโยบายการคืนเงิน</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ติดต่อ
            </h2>
            <p>คำถามเกี่ยวกับข้อกำหนด: <strong>legal@reviewhub.review</strong></p>
            <p>คำถามเกี่ยวกับข้อมูลส่วนบุคคล: <strong>privacy@reviewhub.review</strong></p>
            <p>การใช้งานทั่วไป: <strong>support@reviewhub.review</strong></p>
          </section>
        </article>
      </main>
    </div>
  );
}
