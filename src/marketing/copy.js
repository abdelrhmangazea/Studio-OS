/**
 * Every word on the marketing site, both languages, in one file.
 *
 * Separate from the app's dictionaries on purpose: this is sales
 * copy with its own voice and its own review cycle, and mixing it
 * into the product strings makes both harder to change.
 *
 * THE RULES THIS COPY OBEYS
 *
 *   No invented statistics. Where there is no data there is no
 *   number — "leads get lost" rather than "73% of leads get lost".
 *   Every claim is something the product does TODAY. Nothing here
 *   describes a roadmap.
 *   No testimonials until real ones exist. The placeholder is marked
 *   as a placeholder in the markup, not dressed up as a quote.
 */

export const copy = {
  en: {
    nav: { features: 'Features', how: 'How it works', pricing: 'Pricing', faq: 'FAQ',
           signIn: 'Sign in', start: 'Start free' },

    hero: {
      title: 'Everything an interior designer needs to run their studio — from the first message to the final follow-up, in one place.',
      sub: 'Leads, consultations, contracts, projects, your client portal and your paperwork. Built in Arabic and English.',
      primary: 'Start free', secondary: 'See how it works',
      note: 'No card required. Free plan available.',
    },

    problem: {
      title: 'Six tools that do not talk to each other',
      lead: 'Most studios run on whatever was nearest when they started.',
      tools: ['Instagram DMs', 'WhatsApp', 'Excel', 'Notes app', 'Word', 'Memory'],
      consequencesTitle: 'What that costs you',
      consequences: [
        { t: 'Leads go missing', d: 'A message in one inbox, a number in another, and nobody is sure who was already spoken to.' },
        { t: 'Follow-ups are forgotten', d: 'Not because anyone decided to drop them — because nothing was holding them.' },
        { t: 'Free consultations eat a day', d: 'An unpaid meeting, travel, and a proposal written from scratch afterwards.' },
        { t: 'Paperwork is rebuilt every project', d: 'The same contract, retyped, with last client’s name still in it somewhere.' },
      ],
    },

    how: {
      title: 'One path, every project',
      lead: 'Ten stages in the same order every time. That is what makes two projects comparable, and what makes the reports mean anything.',
      phases: [
        { name: 'Before the work', stages: ['Consultation', 'Fee proposal', 'Contract', 'Onboarding'] },
        { name: 'During the work', stages: ['Concept', 'Design development', 'Drawings & FF&E', 'Construction'] },
        { name: 'After the work', stages: ['Marketing the work', 'Long-term follow-up'] },
      ],
      blocksTitle: 'Every stage has the same five blocks',
      blocks: [
        { t: 'Checklist', d: 'What has to happen at this stage.' },
        { t: 'Documents', d: 'Generated from your templates.' },
        { t: 'Messages', d: 'Written for you to send.' },
        { t: 'Files', d: 'Yours, and what the client may see.' },
        { t: 'Gate', d: 'What must be true before the stage can close.' },
      ],
      blocksNote: 'The same five, in the same places, in all ten stages. Learn one stage and you have learned the product.',
    },

    pillars: {
      title: 'The four that change the most',
      items: [
        { t: 'Client portal',
          d: 'One secret link per project. Your client sees their own progress, approves work, and uploads their transfer receipt. They cannot see another client, another project, or anything else about your studio.',
          k: 'A solo designer looks like a firm.' },
        { t: 'Document generator',
          d: 'Fee proposals and contracts built from the client’s own details, in Arabic or English, as PDF or Word.',
          k: 'Send within 24 hours instead of two days.' },
        { t: 'Fee calculator',
          d: 'Price by square metre, percentage of cost, hours, fixed phase, per room, or cost plus — against what your own past projects actually earned.',
          k: 'Six methods. Use one, ignore the rest.' },
        { t: 'Revision tracking',
          d: 'Every approval timestamped, every free revision counted. When the allowance runs out, the portal says so plainly to the client.',
          k: 'Scope creep stops without an argument.' },
      ],
    },

    features: {
      title: 'Everything else',
      groups: [
        { t: 'Leads & pipeline', d: 'Table or kanban, your own statuses and sources, CSV import, duplicate warnings.' },
        { t: 'Booking', d: 'A public page on your own link. Real availability, your questions, and a slot that can never be double-booked.' },
        { t: 'Projects & stages', d: 'Ten stages, gates that will not open early, and an override that asks you why and keeps the reason.' },
        { t: 'Templates', d: 'Contracts, proposals, invoices and messages in Arabic and English. Edit them; editing never changes a document already generated.' },
        { t: 'Tasks & reminders', d: 'Created by the work itself — a contract sent creates its own chase.' },
        { t: 'Dashboard', d: 'What needs you today, and every number clickable through to the list behind it.' },
        { t: 'Suppliers', d: 'Your own book, with which projects each was actually used on.' },
        { t: 'Reports', d: 'Funnel, revenue, profitability by hour, and which sources actually pay.' },
      ],
    },

    arabic: {
      title: 'Built in Arabic. Not translated into it.',
      points: [
        'Full right-to-left layout, not a mirrored afterthought',
        'Arabic templates written in Arabic, not machine-translated',
        'Hijri occasion reminders — Ramadan, both Eids, Hijri new year',
        'International phone formatting across Egypt and the Gulf',
        'Contracts written to be market-neutral, for you to adapt',
      ],
      note: 'The Arabic came first in this product. It shows in the small places — how a date sits inside an English sentence, how a phone number stays readable in a right-to-left line.',
    },

    pricing: {
      title: 'Pricing', lead: 'Start free. Move when the studio does.',
      codeLabel: 'Have a code? Enter it after you sign up, in Settings → Plan.',
      month: '/month', free: 'Free', soon: 'Price to be announced',
      cta: 'Start free',
    },

    faq: {
      title: 'Questions worth asking',
      items: [
        { q: 'Do you take payments from my clients?',
          a: 'No. There is no payment gateway anywhere in this product. You issue the invoice, your client transfers the money the way they already do, and uploads the receipt. You confirm it yourself.' },
        { q: 'Does it send emails or WhatsApp messages for me?',
          a: 'No. It writes them — with your client’s details already merged in — and you send them from your own phone or inbox. The only emails it ever sends are about your own account.' },
        { q: 'Is my data private?',
          a: 'Every studio is fully isolated at the database level. No query can cross from one studio to another. Your client list is not visible to us in the ordinary course of running the service, and not to any other studio ever.' },
        { q: 'Can my team use it?',
          a: 'Yes, on Studio. Up to five people, with roles — a member sees only the clients and projects assigned to them, and a viewer can read but never change anything.' },
        { q: 'Can I export my data?',
          a: 'Always, on every plan, including after a downgrade. One button in Settings gives you every row your studio owns.' },
        { q: 'What happens if I stop paying?',
          a: 'You move to the Free plan. Nothing is deleted and nothing is locked — everything you have made stays readable and exportable. Only creating new records beyond the free limits is blocked.' },
      ],
    },

    finalCta: {
      title: 'Start with your next client',
      body: 'Create your studio, set it up once, and send your booking link.',
      cta: 'Create your studio', codePlaceholder: 'Access code (optional)',
    },

    footer: { rights: 'Studio OS', terms: 'Terms', privacy: 'Privacy', built: 'Built for interior designers in Egypt and the Gulf.' },
    placeholder: 'PLACEHOLDER — real screenshot to be added',
    testimonialPlaceholder: 'Quotes from the studios using it are coming. Nothing here is invented.',
  },

  ar: {
    nav: { features: 'المزايا', how: 'إزاي بيشتغل', pricing: 'الأسعار', faq: 'أسئلة',
           signIn: 'دخول', start: 'ابدأ مجاناً' },

    hero: {
      title: 'كل اللي مصمم الديكور محتاجه عشان يدير استوديوه — من أول رسالة لآخر متابعة، في مكان واحد.',
      sub: 'العملاء المحتملون، الاستشارات، العقود، المشاريع، بوابة عميلك، وورقك. مبني بالعربي والإنجليزي.',
      primary: 'ابدأ مجاناً', secondary: 'شوف بيشتغل إزاي',
      note: 'من غير كارت. في خطة مجانية.',
    },

    problem: {
      title: 'ستّ أدوات ما بيكلموش بعض',
      lead: 'معظم الاستوديوهات شغالة بأي حاجة كانت قريبة وقت ما بدأوا.',
      tools: ['رسايل إنستجرام', 'واتساب', 'إكسل', 'الملاحظات', 'وورد', 'الذاكرة'],
      consequencesTitle: 'ده بيكلفك إيه',
      consequences: [
        { t: 'عملاء بيضيعوا', d: 'رسالة في صندوق ورقم في صندوق تاني، ومحدش متأكد مين اتكلم معاه قبل كده.' },
        { t: 'متابعات بتتنسى', d: 'مش لأن حد قرر يسيبها — لأن مفيش حاجة كانت ماسكاها.' },
        { t: 'استشارات مجانية بتاكل يوم', d: 'مقابلة من غير مقابل، ومواصلات، وعرض سعر بيتكتب من الصفر بعدها.' },
        { t: 'الورق بيتعاد كل مشروع', d: 'نفس العقد، بيتكتب تاني، وفي مكان ما لسه اسم العميل اللي فات.' },
      ],
    },

    how: {
      title: 'طريق واحد، لكل مشروع',
      lead: 'عشر مراحل بنفس الترتيب في كل مرة. ده اللي بيخلي مشروعين يتقارنوا، واللي بيخلي التقارير ليها معنى.',
      phases: [
        { name: 'قبل الشغل', stages: ['الاستشارة', 'عرض الأتعاب', 'العقد', 'الاستقبال'] },
        { name: 'أثناء الشغل', stages: ['الكونسبت', 'تطوير التصميم', 'الرسومات والمفروشات', 'التنفيذ'] },
        { name: 'بعد الشغل', stages: ['تسويق الشغل', 'متابعة طويلة المدى'] },
      ],
      blocksTitle: 'كل مرحلة فيها نفس الخمس بلوكات',
      blocks: [
        { t: 'قائمة المراجعة', d: 'اللي لازم يحصل في المرحلة دي.' },
        { t: 'المستندات', d: 'بتتولّد من قوالبك.' },
        { t: 'الرسايل', d: 'مكتوبة عشان تبعتها.' },
        { t: 'الملفات', d: 'بتاعتك، واللي العميل مسموح يشوفه.' },
        { t: 'البوابة', d: 'اللي لازم يتحقق قبل ما المرحلة تقفل.' },
      ],
      blocksNote: 'نفس الخمسة، في نفس الأماكن، في العشر مراحل. تتعلم مرحلة واحدة تبقى اتعلمت المنتج.',
    },

    pillars: {
      title: 'الأربعة اللي بيفرقوا أكتر حاجة',
      items: [
        { t: 'بوابة العميل',
          d: 'لينك سري واحد لكل مشروع. عميلك بيشوف تقدّم مشروعه، ويوافق على الشغل، ويرفع إيصال التحويل. مش هيشوف عميل تاني ولا مشروع تاني ولا أي حاجة تانية عن استوديوك.',
          k: 'مصمم لوحده بيبان زي شركة.' },
        { t: 'مولّد المستندات',
          d: 'عروض الأتعاب والعقود بتتبني من بيانات العميل نفسه، عربي أو إنجليزي، PDF أو Word.',
          k: 'تبعت في ٢٤ ساعة بدل يومين.' },
        { t: 'حاسبة الأتعاب',
          d: 'سعّر بالمتر، أو نسبة من التكلفة، أو بالساعة، أو مرحلة ثابتة، أو بالغرفة، أو تكلفة زائد هامش — مقارنة باللي مشاريعك السابقة كسبته فعلاً.',
          k: 'ست طرق. استخدم واحدة وسيب الباقي.' },
        { t: 'تتبّع التعديلات',
          d: 'كل موافقة بتاريخها، وكل تعديل مجاني بيتحسب. ولما العدد يخلص، البوابة بتقول للعميل بوضوح.',
          k: 'زحف النطاق بيقف من غير خناقة.' },
      ],
    },

    features: {
      title: 'وكل اللي باقي',
      groups: [
        { t: 'العملاء المحتملون', d: 'جدول أو لوحة، حالاتك ومصادرك أنت، استيراد CSV، وتنبيه للمكرر.' },
        { t: 'الحجز', d: 'صفحة عامة على لينكك. مواعيدك الحقيقية، أسئلتك، وموعد مستحيل يتحجز مرتين.' },
        { t: 'المشاريع والمراحل', d: 'عشر مراحل، وبوابات مش بتفتح بدري، وتخطّي بيسألك ليه ويسجّل السبب.' },
        { t: 'القوالب', d: 'عقود وعروض وفواتير ورسايل بالعربي والإنجليزي. عدّلها — والتعديل ما بيغيّرش مستند اتعمل قبل كده.' },
        { t: 'المهام والتذكيرات', d: 'الشغل نفسه بيعملها — عقد اتبعت بيعمل متابعته بنفسه.' },
        { t: 'الرئيسية', d: 'اللي محتاجك النهارده، وكل رقم بيتضغط ويوديك للقايمة اللي وراه.' },
        { t: 'الموردون', d: 'دفترك أنت، وكل مورد وأي مشاريع اتعامل معاها فعلاً.' },
        { t: 'التقارير', d: 'القمع، الإيرادات، الربحية بالساعة، وأي المصادر بتجيب فلوس فعلاً.' },
      ],
    },

    arabic: {
      title: 'مبني بالعربي. مش مترجم ليه.',
      points: [
        'تخطيط من اليمين لليسار كامل، مش مجرد مرايا',
        'قوالب عربية مكتوبة بالعربي، مش ترجمة آلية',
        'تذكيرات المناسبات الهجرية — رمضان، العيدين، رأس السنة الهجرية',
        'تنسيق أرقام دولي يغطي مصر والخليج',
        'عقود مكتوبة محايدة السوق، تعدّلها على بلدك',
      ],
      note: 'العربي جه الأول في المنتج ده. وباين في الحاجات الصغيرة — إزاي التاريخ بيقعد جوه جملة إنجليزي، وإزاي رقم التليفون بيفضل مقروء في سطر من اليمين لليسار.',
    },

    pricing: {
      title: 'الأسعار', lead: 'ابدأ مجاناً. واتحرك لما الاستوديو يتحرك.',
      codeLabel: 'معاك كود؟ اكتبه بعد التسجيل من الإعدادات ← الخطة.',
      month: '/شهر', free: 'مجاني', soon: 'السعر هيتحدد',
      cta: 'ابدأ مجاناً',
    },

    faq: {
      title: 'أسئلة تستاهل تتسأل',
      items: [
        { q: 'بتاخدوا فلوس من عملائي؟',
          a: 'لأ. مفيش بوابة دفع في المنتج ده خالص. أنت بتصدر الفاتورة، وعميلك بيحوّل بالطريقة اللي بيحوّل بيها أصلاً، ويرفع الإيصال. وأنت بتأكده بنفسك.' },
        { q: 'بيبعت إيميلات أو واتساب بدالي؟',
          a: 'لأ. بيكتبها — وبيانات عميلك مدمجة فيها — وأنت بتبعتها من تليفونك أو بريدك. الإيميلات الوحيدة اللي بيبعتها بتخص حسابك أنت.' },
        { q: 'بياناتي محمية؟',
          a: 'كل استوديو معزول تماماً على مستوى قاعدة البيانات. مفيش استعلام يقدر يعدّي من استوديو لاستوديو. قايمة عملائك مش ظاهرة لينا في التشغيل العادي للخدمة، ولا لأي استوديو تاني أبداً.' },
        { q: 'فريقي يقدر يستخدمه؟',
          a: 'أيوة، في خطة استوديو. لحد خمس أفراد، بأدوار — العضو بيشوف بس العملاء والمشاريع المسندة له، والمشاهد بيقرا وما بيغيّرش أي حاجة.' },
        { q: 'أقدر أصدّر بياناتي؟',
          a: 'دايماً، في كل الخطط، وحتى بعد الرجوع للمجاني. زرار واحد في الإعدادات بيديك كل صف يخص استوديوك.' },
        { q: 'لو وقفت الدفع بيحصل إيه؟',
          a: 'بتنتقل للخطة المجانية. مفيش حاجة بتتمسح ومفيش حاجة بتتقفل — كل اللي عملته بيفضل مقروء وتقدر تصدّره. اللي بيتمنع بس هو إنشاء سجلات جديدة فوق حدود المجاني.' },
      ],
    },

    finalCta: {
      title: 'ابدأ بعميلك الجاي',
      body: 'أنشئ استوديوك، ظبّطه مرة واحدة، وابعت لينك الحجز بتاعك.',
      cta: 'أنشئ استوديوك', codePlaceholder: 'كود الوصول (اختياري)',
    },

    footer: { rights: 'استوديو أو إس', terms: 'الشروط', privacy: 'الخصوصية', built: 'مبني لمصممي الديكور في مصر والخليج.' },
    placeholder: 'مكان محجوز — صورة حقيقية من التطبيق هتتحط هنا',
    testimonialPlaceholder: 'آراء الاستوديوهات اللي بتستخدمه جاية قريب. مفيش حاجة هنا مخترعة.',
  },
}
