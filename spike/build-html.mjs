// Builds the spike HTML with Cairo embedded as base64 data URIs,
// so the render depends on no network and no system font.
import { readFileSync, writeFileSync } from 'node:fs'

const arabic = readFileSync(new URL('./cairo-arabic.woff2', import.meta.url)).toString('base64')
const latin = readFileSync(new URL('./cairo-latin.woff2', import.meta.url)).toString('base64')

const AR = {
  dir: 'rtl',
  lang: 'ar',
  title: 'عرض أتعاب التصميم الداخلي',
  code: 'IZ-2026-0043',
  paragraphs: [
    'يسعد استوديو إنتيريور زون أن يقدّم لكم هذا العرض لتصميم المساحات الداخلية للوحدة السكنية الواقعة في التجمّع الخامس بالقاهرة الجديدة. يشمل العرض مراحل التصميم كاملةً، بدءاً من الاستشارة الأولى ومروراً بالتصميم المبدئي والرسومات التنفيذية، وحتى الإشراف على التنفيذ وتسليم المشروع.',
    'تستند الأتعاب المذكورة أدناه إلى المساحة الإجمالية ونطاق الأعمال المتفق عليه خلال الاستشارة. تبدأ مدة التنفيذ من تاريخ توقيع العقد وسداد الدفعة الأولى، ولا يبدأ أي عمل قبل استيفاء الشرطين معاً.',
  ],
  mixedLabel: 'المصمم المسؤول:',
  designer: 'Abdelrhman Gazea',
  emailLabel: 'البريد الإلكتروني:',
  email: 'hello@interiorzone.com',
  phoneLabel: 'هاتف:',
  phone: '+20 106 679 2806',
  tableHead: ['البند', 'المساحة (م²)', 'سعر المتر (ج.م)', 'الإجمالي (ج.م)'],
  tableRows: [
    ['تصميم المساحات الداخلية', '240', '1,250', '300,000'],
    ['الرسومات التنفيذية', '240', '450', '108,000'],
    ['الإشراف على التنفيذ', '240', '300', '72,000'],
  ],
  tableTotal: ['الإجمالي', '', '', '480,000'],
  signature: 'التوقيع',
  nameLabel: 'الاسم',
  name: 'عبدالرحمن جازع',
  titleLabel: 'الصفة',
  jobTitle: 'مدير الاستوديو',
  dateLabel: 'التاريخ',
  date: '4 أغسطس 2026',
}

const EN = {
  dir: 'ltr',
  lang: 'en',
  title: 'Interior Design Fee Proposal',
  code: 'IZ-2026-0043',
  paragraphs: [
    'Interior Zone is pleased to submit this proposal for the interior design of the residential unit located in the Fifth Settlement, New Cairo. The proposal covers the full design programme, from the initial consultation through concept design and tender drawings, to construction supervision and handover.',
    'The fees below are based on the total area and the scope of works agreed during the consultation. The programme begins on the date the contract is signed and the first payment is confirmed. No work starts before both conditions are met.',
  ],
  mixedLabel: 'Lead designer:',
  designer: 'Abdelrhman Gazea',
  emailLabel: 'Email:',
  email: 'hello@interiorzone.com',
  phoneLabel: 'Phone:',
  phone: '+20 106 679 2806',
  tableHead: ['Item', 'Area (m²)', 'Rate (EGP)', 'Total (EGP)'],
  tableRows: [
    ['Interior design', '240', '1,250', '300,000'],
    ['Tender drawings', '240', '450', '108,000'],
    ['Construction supervision', '240', '300', '72,000'],
  ],
  tableTotal: ['Total', '', '', '480,000'],
  signature: 'Signature',
  nameLabel: 'Name',
  name: 'Abdelrhman Gazea',
  titleLabel: 'Title',
  jobTitle: 'Studio Director',
  dateLabel: 'Date',
  date: '4 August 2026',
}

const page = (d) => `
<section class="page" dir="${d.dir}" lang="${d.lang}">
  <header class="head">
    <div class="brand">
      <div class="mark">IZ</div>
      <div>
        <div class="studio">Interior Zone</div>
        <div class="code">${d.code}</div>
      </div>
    </div>
  </header>

  <h1>${d.title}</h1>

  ${d.paragraphs.map((p) => `<p>${p}</p>`).join('\n  ')}

  <!-- The bidi test: Arabic + Latin name + email + phone on one line.
       <bdi> isolates each foreign run so the bidi algorithm cannot let
       a neutral character (the "+", the "@", the spaces) drag the wrong
       way. This is the technique, not a workaround. -->
  <p class="mixed">
    ${d.mixedLabel} <bdi>${d.designer}</bdi> —
    ${d.emailLabel} <bdi>${d.email}</bdi> —
    ${d.phoneLabel} <bdi class="nowrap">${d.phone}</bdi>
  </p>

  <table>
    <thead>
      <tr>${d.tableHead.map((h) => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${d.tableRows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n      ')}
      <tr class="total">${d.tableTotal.map((c) => `<td>${c}</td>`).join('')}</tr>
    </tbody>
  </table>

  <div class="sign">
    <div class="line"></div>
    <div class="sign-rows">
      <div><span class="k">${d.signature}</span></div>
      <div><span class="k">${d.nameLabel}:</span> ${d.name}</div>
      <div><span class="k">${d.titleLabel}:</span> ${d.jobTitle}</div>
      <div><span class="k">${d.dateLabel}:</span> <bdi>${d.date}</bdi></div>
    </div>
  </div>
</section>`

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Studio OS — Arabic export spike</title>
<style>
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${arabic}) format('woff2');
    unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+2010-2011,
                   U+FB50-FDFF, U+FE70-FEFC;
  }
  @font-face {
    font-family: 'Cairo';
    font-style: normal;
    font-weight: 400 700;
    src: url(data:font/woff2;base64,${latin}) format('woff2');
    unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122, U+2212;
  }

  @page { size: A4; margin: 18mm 16mm; }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Cairo', sans-serif;
    color: #1d191a;
    font-size: 11pt;
    line-height: 1.9;
    -webkit-font-smoothing: antialiased;
  }

  .page { padding: 0 0 14mm; }
  .page + .page { page-break-before: always; padding-top: 0; }

  .head { border-bottom: 2px solid #0077B6; padding-bottom: 8px; margin-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .mark {
    width: 34px; height: 34px; border-radius: 4px; background: #0077B6; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 12pt; letter-spacing: .5px;
  }
  .studio { font-weight: 700; font-size: 12pt; }
  .code { font-size: 9pt; color: #5a5a5a; }

  h1 { font-size: 17pt; font-weight: 700; margin: 0 0 14px; color: #1d191a; }
  p { margin: 0 0 12px; text-align: justify; }
  .mixed { background: #f4f8fb; border-inline-start: 3px solid #0077B6; padding: 8px 12px; }
  /* A phone number must never break across lines. */
  .nowrap { white-space: nowrap; }

  table { width: 100%; border-collapse: collapse; margin: 18px 0 24px; font-size: 10.5pt; }
  th, td { border: 1px solid #d8d8d8; padding: 7px 10px; text-align: start; }
  thead th { background: #f2f2f2; font-weight: 700; }
  tr.total td { font-weight: 700; background: #f8f8f8; }

  .sign { margin-top: 26px; }
  .sign .line { width: 190px; border-top: 1px solid #1d191a; margin-bottom: 8px; }
  .sign-rows div { margin-bottom: 3px; font-size: 10.5pt; }
  .k { color: #5a5a5a; }
</style>
</head>
<body>
${page(AR)}
${page(EN)}
</body>
</html>`

writeFileSync(new URL('./sample.html', import.meta.url), html)

// English page on its own, only so page 2 can be inspected as a
// single-page render during this spike.
writeFileSync(
  new URL('./sample-en.html', import.meta.url),
  html.replace(page(AR), '')
)

console.log('sample.html written —', (html.length / 1024).toFixed(0) + 'KB with fonts inlined')
