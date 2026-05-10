// Build Gmail compose URLs for the 7 Wave 4 prospects (Methavalai #1 skipped).
// Output: lines of `PROSPECT_ID|TIME_HHMM_DAY|RECIPIENT|GMAIL_COMPOSE_URL`
//
// Use these URLs by navigating Chrome MCP to each → Gmail compose opens with
// recipient/subject/body pre-filled → click Send dropdown → Schedule send → set time.

const drafts = [
  {
    id: 2,
    day: 'Tue',
    time: '9:35',
    to: 'res@lilithotel.com',
    subject: 'Lilit Bang Lamphu — ลองร่างคำตอบให้ดูครับ',
    body: `สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lilit Bang Lamphu เมื่อกี้ เห็นว่ามีรีวิวที่ยังไม่ได้ตอบหลายอัน รวมถึงรีวิว 4 ดาวของ Olga ที่ติดเรื่อง luggage storage ในทางเดินไม่มีระบบล็อก และประตูชั้น 1 ที่ต้องใช้คีย์การ์ดเปิด — เป็นจุดที่ตอบแบบที่บอกว่าจะแก้ น่าจะกลับเป็น 5 ดาวได้

เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของโรงแรม ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ https://reviewhub.review/audit-preview/27dc09c874f0bd9e6b423bc962405a521e54be65453beae3

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น USD 14 (~฿490)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 3,
    day: 'Tue',
    time: '9:40',
    to: 'info@raweekanlaya.com',
    subject: 'Raweekanlaya — ลองร่างคำตอบรีวิวให้ดูครับ',
    body: `สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ The Raweekanlaya Wellness เมื่อกี้ เห็นว่ามีรีวิวที่ยังไม่ได้ตอบหลายอัน รวมถึงรีวิว 5 ดาวของ Shakir ที่เล่าว่าทีมงานช่วยทำอาหารฮาลาลให้กลุ่มลูกค้า 12 คนทุกวัน — ตอบรีวิวนี้ดีๆ น่าจะดึงลูกค้ามุสลิมเข้ามาได้อีกมาก

โดยเฉพาะแบรนด์ที่เน้น wellness/voice แบบนี้ คำตอบรีวิวเป็นจุดที่ลูกค้าใหม่ดูเพื่อเช็คว่าเจ้าของใส่ใจจริงรึเปล่า เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Raweekanlaya ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ https://reviewhub.review/audit-preview/60442bfb15420e24f63b76f8a9e29841f87c68592b2c2c17

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น USD 14 (~฿490)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 4,
    day: 'Tue',
    time: '9:45',
    to: 'hotel@lamphutreehotel.com',
    subject: 'Lamphu Tree House — รีวิว Google ที่ยังไม่ได้ตอบ',
    body: `สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lamphu Tree House เมื่อกี้ เห็นว่ามีรีวิวที่ยังไม่ได้ตอบหลายอัน รวมถึงรีวิว 4 ดาวของ Lovette ที่ติดเรื่องเตียงค่อนข้างแข็งและ AC เย็นช้า — เป็นจุดเล็กๆ ที่ตอบแล้วบอกว่าจะแก้ น่าจะดึงเป็น 5 ดาวได้

ที่พักที่เจ้าของลงรายละเอียดเองแบบนี้ คำตอบรีวิวมีน้ำหนักมากกว่าโรงแรมเชน ลูกค้าใหม่ดูออกเลยว่าใครเป็นคนตอบ เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Lamphu Tree House ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ https://reviewhub.review/audit-preview/d912741c6aced4d5e1eb8bef20a2b442149ce5227e3415e2

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น USD 14 (~฿490)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 5,
    day: 'Tue',
    time: '9:50',
    to: 'info@lamphuhousebangkok.com',
    subject: 'Lamphu House — ลองร่างคำตอบรีวิวให้ดูครับ',
    body: `สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Lamphu House เมื่อกี้ เห็นว่ามีรีวิวที่ยังไม่ได้ตอบหลายอัน รวมถึงรีวิว 4 ดาวของ Lenka ที่บอกว่าตอน check-in เจอพนักงานหน้าบึ้ง — เป็นรีวิวที่ตอบดีๆ บอกว่ารับเรื่องไปสอนต่อ น่าจะดึงเป็น 5 ดาวได้

เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของบ้าน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ https://reviewhub.review/audit-preview/ef5a7943a9c6351c49770eb0bbfc9e3df9fe838a7fc20869

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ ลูกค้าต่างชาติเขียนภาษาไหน ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น USD 14 (~฿490)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 7,
    day: 'Wed',
    time: '9:30',
    to: 'info@nouvocityhotel.com',
    subject: 'Nouvo City Hotel — reply drafts for your unanswered reviews',
    body: `Hi,

Was looking through Nouvo City Hotel's Google profile and noticed several reviews are unanswered, including Hevpot UK's 5-star where they noted the superior twin had no window and the Agoda listing was misleading. Replying to that one with a quick "we've fixed the listing" + "would love to host you in our window-side room next time" could turn a slightly-frustrated 5-star into a strong testimonial.

I drafted reply suggestions for all 5 — AI-drafted, but in a tone that sounded like how you might reply yourself. Take a look (no signup, just a preview link):

→ https://reviewhub.review/audit-preview/0a410de8779594cb7757974ff026a714494a95b512f5a24e

One thing that might be relevant for Nouvo specifically — given the halal-certified positioning, your reviews probably come in 5+ languages. The drafts auto-detect the reviewer's language, so the Arabic, Hindi, Urdu reviews get replies in those languages. Most review-reply tools only do English.

New reviews also ping you on LINE — no need to check Google daily to know one came in.

Use any of the drafts directly. If you want this running on autopilot every time a new review lands, the entry plan is USD 14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 8,
    day: 'Wed',
    time: '9:35',
    to: 'info@publichouse-hotels.com',
    subject: 'Public House — quick observation on your Google reviews',
    body: `Hi Paul,

Was looking through Public House's Google profile and noticed several reviews are unanswered, including Marci Scott's 2-star about a persistent musty odor in her room. That one specifically deserves a reply — even a brief "thank you for flagging, we've addressed this" defuses the public read of it.

I drafted reply suggestions for all 5 — AI-drafted, but in a tone that tries to match how a design-hotel owner would actually reply, not the corporate template most chains use. Take a look (no signup, just a preview link):

→ https://reviewhub.review/audit-preview/2ca3d5a91bd2ee6b5efb28467f3eedaa0b1fae367e62b771

The drafts also auto-detect the reviewer's language — Japanese, Korean, Chinese reviews get replies in those languages, not English.

New reviews also ping you on LINE — no need to check Google daily to know one came in.

Use any directly if useful. If you want this running on autopilot every time a new review lands, the entry plan is USD 14/mo.

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
  {
    id: 9,
    day: 'Wed',
    time: '9:40',
    to: 'hello@volvehotel.com',
    subject: 'Volve Hotel — ลองร่างคำตอบให้ดูครับ',
    body: `สวัสดีครับ

ผม Earth ทำเครื่องมือชื่อ ReviewHub ครับ ช่วยเจ้าของโรงแรมตอบรีวิว Google ให้เร็วขึ้น

แวะดู Google ของ Volve Hotel เมื่อกี้ เห็นว่ามีรีวิวที่ยังไม่ได้ตอบหลายอัน รวมถึงรีวิว 4 ดาวของ Qi Wun ที่ชมว่าทีมงาน Volve คอยใส่ใจลูกค้าระดับที่บอกว่า "ระดับนี้คนญี่ปุ่นยังทำไม่ถึง" — ตอบรีวิวนี้ดีๆ น่าจะอวดทีมงานต่อให้คนที่กำลังจะจองได้

โรงแรมแบบ neighbourhood design hotel ที่เจ้าของลงทุนกับตัวตนของแบรนด์แบบนี้ คำตอบรีวิวเป็นจุดที่ลูกค้าใหม่ดูเพื่อเช็คโทนของโรงแรม เลยลองให้ AI ของเราร่างคำตอบให้ดูครับ พยายามเขียนในโทนที่น่าจะใกล้กับสไตล์ของ Volve ไม่ใช่โทนโรงแรมเชน ลองเปิดดูได้เลย ไม่ต้องสมัครอะไร

→ https://reviewhub.review/audit-preview/c2fb8cce06d58b5cd4eb28737f56b832582bc4fe254f9199

ระบบตอบเป็นภาษาเดียวกับรีวิวอัตโนมัติด้วยครับ รีวิวญี่ปุ่น/เกาหลี/จีน/อังกฤษ ก็ตอบเป็นภาษานั้น

อีกอย่างคือ ระบบส่งแจ้งเตือนรีวิวใหม่เข้า LINE ด้วยครับ ไม่ต้องเปิด Google ทุกวันก็รู้ว่ามีรีวิวเข้ามา

คำตอบที่ร่างเอาไปใช้ได้เลยฟรีครับ ถ้าอยากให้ระบบทำแบบนี้ทุกครั้งที่มีรีวิวใหม่ มีแพ็กเกจเริ่มต้น USD 14 (~฿490)/เดือน

ส่งให้ดูเผื่อมีประโยชน์เฉย ๆ ครับ ขอบคุณที่อ่านครับ

— Earth
ReviewHub · reviewhub.review
Bangkok`,
  },
];

const out = drafts.map(d => {
  const url = `https://mail.google.com/mail/u/1/?view=cm&fs=1&to=${encodeURIComponent(d.to)}&su=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  return { id: d.id, day: d.day, time: d.time, to: d.to, subject: d.subject, url };
});
require('fs').writeFileSync('C:/Users/Computer/AppData/Local/Temp/wave4-compose-urls.json', JSON.stringify(out, null, 2));
console.log('Wrote', out.length, 'compose URLs');
for (const u of out) console.log(`#${u.id} ${u.day} ${u.time} → ${u.to}`);
