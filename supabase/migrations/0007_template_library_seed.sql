-- =============================================================
-- Studio OS — Bucket 3: the seeded template library
--
-- Generated from src/data/seed/*.json, byte for byte. The bodies are
-- the studio's own text and are imported verbatim, including the paste
-- artifacts in some of them — they are edited in the app, not here.
--
-- 34 message rows = 17 keys x 2 languages,
-- paired by (key, language) and never by array order.
-- =============================================================

insert into public.template_library
  (key, type, channel, stage, language, title, subject, body, sort_order)
values
  ($seedtxt$consultation_booking_invite$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'en'::public.app_language, $seedtxt$Next Step – Booking Your Consultation$seedtxt$, $seedtxt$Next Step – Booking Your Consultation$seedtxt$, $seedtxt$Hi {{client_first_name}},
Thank you for reaching out about {{project_name}} — I'd be glad to help you design your space.
The next step is a {{consultation_type}} consultation, {{consultation_duration}} long, where we'll walk through the space and talk about what you're hoping it will do for you. You'll come away with a clear picture of the project scope and the step that follows.
You can choose a time that works for you here:
{{booking_link}}
Once your appointment is confirmed, you'll receive an email with the full details.
Looking forward to it,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 0),
  ($seedtxt$consultation_booking_invite$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'ar'::public.app_language, $seedtxt$حجز موعد الاستشارة$seedtxt$, $seedtxt$الخطوة التالية – حجز موعد الاستشارة$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
سعدت بتواصلك بخصوص {{project_name}}، ويسعدني أن أساعدك في تصميم مساحتك.
الخطوة التالية استشارة {{consultation_type}} مدتها {{consultation_duration}}، نتعرّف فيها على المساحة وعلى التوقعات المرجوة منها، ونخرج بتصوّر واضح لنطاق العمل والخطوة التي تليه.
يمكنك اختيار الموعد المناسب من هنا:
{{booking_link}}
وبعد تثبيت الموعد ستصلك رسالة تأكيد تتضمّن التفاصيل.
في انتظارك،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 0),
  ($seedtxt$consultation_confirmation$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'en'::public.app_language, $seedtxt$Confirmed: Your Design Consultation$seedtxt$, $seedtxt$Confirmed: Your Design Consultation – {{consultation_date}}$seedtxt$, $seedtxt$Hi {{client_first_name}},
I'm glad to confirm your consultation. Here are the details:
• Date and time: {{consultation_date}}
• Meeting format: {{consultation_mode}}
• Location / link: {{property_address}}
• Expected duration: {{consultation_duration}}
During our meeting, we'll talk about what the space needs to do and how daily life works in it, and I'll come away with an initial sense of the design direction and the next step.
To make the most of our time together, it helps if I can see the following beforehand:
• Photos of the space as it is now, from a few different angles — these give me an early read on the lighting and layout.
• Rough measurements if you have them, or the floor plan if one is available.
• Images or references you like — and any you don't like, which are just as useful to me.
• A rough sense of your budget, even as a range, so the conversation about solutions stays realistic from the start.
If none of these are available, that's completely fine — we'll start with whatever you have.
If you need to reschedule, just reply to this email at least 24 hours before the appointment and I'll rearrange it.
Looking forward to meeting you,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 1),
  ($seedtxt$consultation_confirmation$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'ar'::public.app_language, $seedtxt$ما قبل الاستشاره- تأكيد الموعد$seedtxt$, $seedtxt$تأكيد موعد استشارتك التصميمية – {{consultation_date}}$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
سعيدة بتأكيد موعد استشارتك. هذه تفاصيل اللقاء:
• التاريخ والوقت: {{consultation_date}}
• طريقة اللقاء: {{consultation_mode}}
• المكان / الرابط: {{property_address}}
• المدة المتوقعة: {{consultation_duration}}
خلال اللقاء سنتحدث عن احتياجات المساحة وطبيعة الحياة اليومية فيها، وأخرج بتصوّر مبدئي لاتجاه العمل والخطوة التالية.
ولأستثمر وقت اللقاء بأفضل شكل، يفيدني الاطلاع مسبقاً على:
• صور للمساحة الحالية من زوايا مختلفة — تعطيني قراءة أولية للإضاءة والتوزيع.
• مقاسات تقريبية إن توفّرت، أو مخطط الوحدة إن كان متاحاً.
• صور أو مراجع أعجبتك — وأي مرجع لم يعجبك أيضاً، فهو مفيد بالقدر نفسه.
• تصوّر مبدئي للميزانية، ولو كنطاق تقريبي، ليكون الحديث عن الحلول واقعياً منذ البداية.
وإن لم يتوفّر أي من هذه العناصر، فلا مشكلة إطلاقاً — نبدأ بما هو متاح.
في حال الحاجة إلى تعديل الموعد، يكفي الرد على هذا البريد قبل 24 ساعة من اللقاء وسأتولّى إعادة الترتيب.
في انتظار لقائنا،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 1),
  ($seedtxt$decline_project_after_consultation$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'en'::public.app_language, $seedtxt$Rejection email$seedtxt$, $seedtxt$Rejection email$seedtxt$, $seedtxt$Hi {{client_first_name}},
Thank you for your time during our consultation on {{consultation_date}}, and for trusting me with your project.
After reviewing the details of {{project_name}} carefully, I've come to the conclusion that the project as it currently stands calls for a different approach than the one the studio offers. I'd rather be straightforward with you about that now than take on work I couldn't give the attention it deserves.
This isn't a judgment on the project — it's a question of fit between what you need and what we specialize in.
I'd be glad to recommend someone I think would be a better match, or to answer any questions that help you with your next step. And if the scope changes down the road, our door stays open.
Wishing you all the best,
{{designer_name}}
{{designer_title}}$seedtxt$, 2),
  ($seedtxt$decline_project_after_consultation$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'ar'::public.app_language, $seedtxt$اعتذار عن المشروع بعد الاستشاره$seedtxt$, $seedtxt$اعتذار عن المشروع بعد الاستشاره$seedtxt$, $seedtxt$t: اعتذار عن المشروع
{{client_first_name}}، تحية طيبة،
شكرًا لوقتك في استشارة {{consultation_date}} ولثقتك في عرض مشروعك عليّ.
بعد مراجعة تفاصيل {{project_name}} بعناية، وجدت أن المشروع في وضعه الحالي يحتاج إلى مقاربة مختلفة عمّا يقدّمه الاستوديو، وأفضّل أن أصارحك بهذا من البداية بدل أن ندخل في عمل لا أستطيع أن أعطيه ما يستحق.
هذا ليس حكمًا على المشروع — هو مسألة توافق بين ما تحتاجه وما نتخصّص فيه.
يسعدني أن أرشّح لك من أراه أنسب، أو أن أجيب على أي سؤال يساعدك في خطوتك التالية. وإن تغيّر نطاق المشروع مستقبلًا فبابنا مفتوح.
أتمنى لك التوفيق،
{{designer_name}}$seedtxt$, 2),
  ($seedtxt$client_declined_followup$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'en'::public.app_language, $seedtxt$Thank you for letting me know$seedtxt$, $seedtxt$Thank you for letting me know – {{project_name}}$seedtxt$, $seedtxt$If the client rejected you after consultation
Hi {{client_first_name}},
Thank you for letting me know your decision on {{project_name}}. I appreciate the clarity at this stage, and I wish the project every success.
If you have a moment for one question:
what was the main factor that tipped the decision the other way — the price, the scope of work, the timing, or something I may have missed? A single line is enough.
I'm asking to improve what I offer. There will be no follow-up pitch and no attempt to change your mind.
And if anything comes up that's worth discussing down the road, my door is open.
All the best,
{{designer_name}}
{{designer_title}}$seedtxt$, 3),
  ($seedtxt$client_declined_followup$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$01_consultation$seedtxt$, 'ar'::public.app_language, $seedtxt$لو العميل هو الي رفض- ايميل متابعة$seedtxt$, $seedtxt$شكرًا لك$seedtxt$, $seedtxt$لو العميل هو الي رفض- ايميل متابعة
أهلاً {{client_first_name}}،
شكراً لإعلامي بالقرار بخصوص {{project_name}}؛ الوضوح في هذه المرحلة أمر أقدّره فعلاً، وأتمنى للمشروع كل التوفيق.
ولو سمح الوقت بسؤال واحد فقط: ما العامل الأساسي الذي رجّح الاتجاه الآخر — السعر، أم نطاق العمل، أم التوقيت، أم شيء آخر لم أنتبه إليه؟ سطر واحد يكفي تماماً.
أطرح السؤال لتحسين ما أقدّمه لا أكثر، ولن تتبعه أي محاولة لإعادة العرض أو للإقناع بالعدول عن القرار.
وإن جدّ ما يستدعي النقاش لاحقاً، فالباب مفتوح في أي وقت.
مع خالص التقدير،
{{designer_name}}
{{designer_title}}$seedtxt$, 3),
  ($seedtxt$fee_proposal_send$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$02_fee_proposal$seedtxt$, 'en'::public.app_language, $seedtxt$fee proprosal$seedtxt$, $seedtxt$fee proprosal$seedtxt$, $seedtxt$Subject- Design Fee Proposal
1. Project Overview
Project Type: {{project_type}}
Location: {{property_address}}
Proposed Start: {{requested_start_date}}
{{project_description}}
Based on our consultation on {{consultation_date}}, my understanding of the brief is as follows:
[Write your understanding of the project here, in your own words — what the client actually wants, and what problem the design solves. This paragraph is what makes the proposal personal rather than a generic template.]
2. Scope of Work
Phase 1 — Concept Design
Space study and spatial distribution
Mood board and design direction
Preliminary layout plans
Phase 2 — Design Development
Working drawings
Selection of materials and finishes
3D visualizations of the primary spaces
Phase 3 — FF&E (Furniture, Fixtures & Equipment)
Full specification schedule
Procurement schedule with pricing and suppliers
Phase 4 — Tendering
Preparation of the tender package
Bid review and contractor recommendation
Phase 5 — Site Supervision
Periodic site visits
Review of executed works against the approved design
[Remove or add phases according to what has been agreed with this client.]
Exclusions
The following fall outside the scope of this proposal:
Structural works and permits
Professional photography after handover
Any phase not listed above
3. Fee Structure
Notes:
Fees do not include the cost of furniture, materials, or contractor works.
Any material revision requested after a phase has been approved will be quoted separately as an additional service.
This proposal is valid for 30 days from the date above.
4. Next Step
Upon your approval of this proposal, we will send the contract and the payment schedule, and work will commence within [___] of receipt of the first payment.
Thank you,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 4),
  ($seedtxt$fee_proposal_send$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$02_fee_proposal$seedtxt$, 'ar'::public.app_language, $seedtxt$ايميل الاتعاب$seedtxt$, $seedtxt$ايميل الاتعاب$seedtxt$, $seedtxt$عنوان - عرض الاتعاب
عرض أتعاب — {{project_name}}
كود المشروع: {{project_code}}
التاريخ: {{today_date}}
مُعدّ لـ: {{client_full_name}}
١. نظرة عامة على المشروع
نوع المشروع: {{project_type}}
الموقع: {{property_address}}
البداية المقترحة: {{requested_start_date}}
{{project_description}}
بناءً على ما ناقشناه في استشارة {{consultation_date}}، فهمي للمطلوب هو:
[اكتب هنا فهمك للمشروع بكلماتك — ما الذي يريده العميل فعلًا، وما المشكلة التي يحلّها التصميم. هذه الفقرة هي التي تجعل العرض شخصيًا وليس نموذجًا جاهزًا.]
٢. نطاق العمل
المرحلة الأولى — التصميم المبدئي
• دراسة المساحة وتوزيع الفراغات
• لوحة المزاج واتجاه التصميم
• مخططات مبدئية للتوزيع
المرحلة الثانية — تطوير التصميم
• مخططات تنفيذية
• اختيار الخامات والتشطيبات
• رسومات ثلاثية الأبعاد للمساحات الرئيسية
المرحلة الثالثة — الأثاث والمفروشات والتجهيزات
• قائمة مواصفات كاملة
• جدول مشتريات بالأسعار والموردين
المرحلة الرابعة — طرح المناقصة
• إعداد ملف الطرح
• مراجعة العروض والترشيح
المرحلة الخامسة — الإشراف على التنفيذ
• زيارات موقع دورية
• مراجعة الأعمال ومطابقتها للتصميم
[احذف أو أضف حسب المتفق عليه مع هذا العميل.]
خارج نطاق هذا العرض:
• الأعمال الإنشائية والتراخيص
• التصوير الاحترافي بعد التسليم
• أي مرحلة غير مذكورة أعلاه
٣. هيكل الأتعاب
المرحلة                          الأتعاب        موعد السداد
المرحلة الأولى                   ___ {{currency}}   عند التوقيع
المرحلة الثانية                  ___ {{currency}}   عند اعتماد التصميم المبدئي
المرحلة الثالثة                  ___ {{currency}}   عند تسليم المخططات التنفيذية
المرحلة الرابعة                  ___ {{currency}}   عند طرح المناقصة
المرحلة الخامسة                  ___ {{currency}}   على دفعات شهرية أثناء التنفيذ
الإجمالي                         ___ {{currency}}
ملاحظات:
• الأتعاب لا تشمل قيمة الأثاث أو الخامات أو أعمال المقاولين.
• أي تعديل جوهري بعد اعتماد مرحلة يُسعّر بشكل منفصل.
• هذا العرض ساري لمدة ٣٠ يومًا من تاريخه.
٤. الخطوة التالية
عند موافقتك على هذا العرض نرسل لك العقد وجدول الدفعات، ونبدأ العمل خلال [___] من استلام الدفعة الأولى.
{{designer_name}}$seedtxt$, 4),
  ($seedtxt$contract_send$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$03_contract$seedtxt$, 'en'::public.app_language, $seedtxt$Contract Document$seedtxt$, $seedtxt$Contract Documents$seedtxt$, $seedtxt$Hi {{client_first_name}},
Thank you for approving the proposal, and for trusting me with {{project_name}}.
Attached is everything needed to formally begin:
1. The contract — covering the scope of work, the project phases, and the responsibilities on both sides
2. The scope appendix — a breakdown of what each phase includes and what it does not
3. The payment schedule
4. The initial invoice
What's needed from your side:
• Review the contract and the appendix, and let me know if any clause needs discussion before signing
• Send the signed copy back
• Pay the initial invoice via {{payment_method}}
The scope appendix sets out what each phase does not include.
The intent is to protect both of us from any misunderstanding later on.
I'm glad to walk you through any clause.
Work begins as soon as I receive the signed copy and the first payment.
Kindly sign the contract by {{signing_deadline}}.
Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 5),
  ($seedtxt$contract_send$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$03_contract$seedtxt$, 'ar'::public.app_language, $seedtxt$التعاقد$seedtxt$, $seedtxt$مستندات التعاقد$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
شكراً لموافقتك على العرض، وللثقة فيما سنعمل عليه معاً في {{project_name}}.
مرفق ما يلزم لبدء العمل رسمياً:
١. العقد — يشمل نطاق العمل والمراحل والالتزامات المتبادلة
٢. ملحق نطاق الأعمال — تفصيل ما تشمله كل مرحلة وما لا تشمله
٣. جدول الدفعات
٤. الدفعة الأولى للبدء
والخطوات المطلوبة:
• مراجعة العقد والملحق، وإخباري بأي بند يحتاج نقاشاً قبل التوقيع
• إرسال النسخة موقّعة
• سداد فاتورة البدء عبر {{payment_method}}
ملحق نطاق الأعمال يوضّح ما لا تشمله كل مرحلة بالدقة والغرض حماية الطرفين من أي التباس لاحقاً.
يسعدني شرح أي بند.
سيبدأ العمل فور استلام النسخة الموقّعة من العقد والدفعة الأولى.
يرجى توقيع العقد في خلال يومين {{signing_deadline}}.
تحياتي،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 5),
  ($seedtxt$contract_followup$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$03_contract$seedtxt$, 'en'::public.app_language, $seedtxt$Following up – {{project_name}} contract$seedtxt$, $seedtxt$Following up – {{project_name}} contract$seedtxt$, $seedtxt$Hi {{client_first_name}},
Just following up on the contract for {{project_name}}, sent on {{contract_sent_date}}.
I haven't received the signed copy yet.
If there's a clause you'd like to discuss, I'm happy to walk through it — and if it's simply a matter of a busy schedule, that's completely fine; just let me know a timeframe that works for you.
One note on timing: your place in the studio schedule is reserved from the date the signed contract is received.
Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 6),
  ($seedtxt$contract_followup$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$03_contract$seedtxt$, 'ar'::public.app_language, $seedtxt$تذكير — عقد {{project_name}}$seedtxt$, $seedtxt$تذكير — عقد {{project_name}}$seedtxt$, $seedtxt$Subject- تذكير — عقد {{project_name}}
{{client_first_name}}، تذكير سريع.
تذكير بسيط بخصوص عقد {{project_name}} المرسل في {{contract_sent_date}}.
لم تصلني النسخة الموقّعة بعد. لو في أي بند يحتاج نقاشًا أنا جاهز — ولو الموضوع مجرد انشغال، لا مشكلة إطلاقًا، أخبرني فقط بموعد يناسبك.
أذكّر أن حجز فترة العمل في جدول الاستوديو يبدأ من تاريخ استلام العقد الموقّع.
تحياتي،
{{designer_name}}$seedtxt$, 6),
  ($seedtxt$onboarding_getting_started$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$04_onboarding$seedtxt$, 'en'::public.app_language, $seedtxt$Subject: Getting Started on {{project_name}} – Fi…$seedtxt$, $seedtxt$Getting Started -First Steps$seedtxt$, $seedtxt$Hi {{client_first_name}},
I've received the signed contract and the first payment, which means work on {{project_name}} is officially underway. I'm glad to be getting started.
Attached are three documents:
1. The welcome pack — how we work, what to expect at each phase, and the payment schedule
https://www.canva.com/design/DAHRI3TbBBc/XibmaGfah2S4bn7TfIjCZA/edit
2. The questionnaire form — the most important document at this stage, since the design is built on your answers. It takes about {{form_duration}}
https://docs.google.com/document/d/1H5fcP4sj3536fcluvSepKn20TYV1FWjL/edit?usp=sharing&ouid=117448710378731351809&rtpof=true&sd=true
3. A short video (3 minutes) explaining the steps ahead
Welcome Video — Sample Script
Target length: 3 minutes
1. Welcome (20 seconds)
"Hi {{client_first_name}}. I recorded this short video to welcome you officially to {{project_name}} and walk you through what happens next — in about three minutes."
2. What Happens Now (45 seconds)
Cover: the information form → the kickoff meeting → the first design direction. Give real dates, not general statements.
"The first thing you'll find is the information form. Next comes the kickoff meeting. And about [___] after that, you'll have the first design direction to look at."
3. What We Need From You (45 seconds)
Be specific: the form within two days, the kickoff meeting booked, photos and measurements of the space.
"The one thing that keeps the project on schedule more than anything else is getting that form back to me within two days."
4. How We Communicate (30 seconds)
Talk through your preferred channels and your availability — for example: email for decisions, replies within one to two business days.
5. Closing (20 seconds)
"I'm glad we're underway. If anything comes up, I'm here — any time. I'll talk to you at the kickoff meeting."
Filming Notes
Record it in one take — natural beats perfect
Share your screen while walking through the welcome pack
Say the client's name at least twice
Two things are needed from you-
• Complete the questionnaire form
• Book the kickoff meeting here: {{booking_link}}
I'd suggest completing the form before the meeting, so our time together goes to discussion and finer details rather than gathering the basics.
You're also welcome to bring anyone who has a say in the project's decisions — aligning on the vision early saves a great deal of time later.
Welcome aboard,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 7),
  ($seedtxt$onboarding_getting_started$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$04_onboarding$seedtxt$, 'ar'::public.app_language, $seedtxt$Subject: بداية العمل  – الخطوات الأولى$seedtxt$, $seedtxt$بداية العمل  – الخطوات الأولى$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
وصلني العقد الموقّع والدفعة الأولى، وبهذا يبدأ العمل على {{project_name}} رسمياً.
سعيدة بانطلاق المشروع.
مرفق ثلاثة مستندات:
١. حقيبة الترحيب — آلية العمل، وما يمكن توقّعه في كل مرحلة، وجدول الدفعات
https://www.canva.com/design/DAHRI4vGLO0/ptMN3inJXqQ3iGUJa7Q7qA/edit
٢. استمارة المعلومات — أهم مستند في هذه المرحلة؛ فالتصميم يُبنى على إجاباتها. تستغرق نحو {{form_duration}}
https://docs.google.com/document/d/1kMOWnO40D7nVqXHjLNy5ONi53Mq7kB-m/edit?usp=sharing&ouid=117448710378731351809&rtpof=true&sd=true
٣. فيديو قصير (٣ دقائق) يشرح الخطوات القادمة
(مثال عن السكريبت
المدة المستهدفة: ٣ دقائق
١. الترحيب (٢٠ ثانية)
"أهلًا {{client_first_name}}، أنا {{designer_name}}. سجّلت لك الفيديو ده عشان أرحّب بيك رسميًا في {{project_name}} وأوضّح لك الخطوات الجاية في ٣ دقايق."
٢. ماذا سيحدث الآن (٤٥ ثانية)
اشرح: الاستمارة ← اجتماع الانطلاق ← أول عرض تصميم.
اذكر تواريخ حقيقية لا كلامًا عامًا.
"أول حاجة هتلاقيها الاستمارة. تاني حاجة اجتماع الانطلاق. وبعدها بـ[___] هيبقى عندك أول تصوّر للتصميم."
٣. ما نحتاجه منك (٤٥ ثانية)
كن محدّدًا: الاستمارة خلال يومين، حجز الاجتماع، صور ومقاسات المساحة.
"أكتر حاجة هتخلّي المشروع يمشي في وقته إن الاستمارة توصلني خلال يومين."
٤. كيف نتواصل (٣٠ ثانية)
اتكلم عن طريقتك المفضله في التواصل و المواعيد المناسبه ليك مثل -
الإيميل للقرارات، الرد خلال يوم عمل إلى يومين.
٥. الختام (٢٠ ثانية)
"مبسوط إننا بدأنا. لو في أي سؤال مستني منك في أي وقت. نتكلم في اجتماع الانطلاق."
ملاحظات تصوير:
• سجّل الفيديو مرة واحدة — العفوية أفضل من الكمال
• شارك الشاشة وأنت تعرض حقيبة الترحيب
• اذكر اسم العميل مرتين على الأقل)
المطلوب الان
• إكمال استمارة المعلومات
• حجز اجتماع الانطلاق من هنا: {{booking_link}}
ويُفضّل إكمال الاستمارة قبل الاجتماع، حتى يكون وقتنا فيه مخصصاً للنقاش والتفاصيل الدقيقة لا لجمع المعلومات الأساسية.
ويسعدني حضور كل من له رأي في قرارات المشروع؛ فاتفاق الرؤية من البداية يوفّر وقتاً كثيراً لاحقاً.
أهلاً بك في المشروع،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 7),
  ($seedtxt$weekly_progress_update$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$execution$seedtxt$, 'en'::public.app_language, $seedtxt$friday reminder$seedtxt$, $seedtxt${{project_name}} — Weekly Update (date)$seedtxt$, $seedtxt$Hi {{client_first_name}},
Status: {{overall_status}}
Current phase: {{delivery_stage}}
Next milestone: {{next_milestone}} on {{milestone_date}}
NEEDED FROM YOU
• [Item] — by [date] — [what it unblocks]
• [Item] — by [date] — [what it unblocks]
(If nothing is needed this week: "Nothing needed from you this week — you're all clear.")
COMPLETED THIS WEEK
• [...]
• [...]
WATCH LIST
• [Issue] — [impact on schedule or budget] — [what I'm doing about it]
(Raise things early. A problem named on time gets solved; a problem hidden gets bigger.)
NEXT WEEK
• [...]
• [...]
Any questions, just reply to this email.
Best regards,
{{designer_name}}
{{designer_title}}
—
Status key: ( state th status) like : On track · Needs attention · At risk$seedtxt$, 8),
  ($seedtxt$weekly_progress_update$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$execution$seedtxt$, 'ar'::public.app_language, $seedtxt$تحديث الأسبوع$seedtxt$, $seedtxt$}} — تحديث الأسبوع ({{week_ending_date}})$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
الحالة العامة: {{overall_status}}
المرحلة الحالية: {{delivery_stage}}
المحطة القادمة: {{next_milestone}} بتاريخ {{milestone_date}}
المطلوب منك
• [البند] — قبل [التاريخ] — [ما الذي يتوقّف عليه]
• [البند] — قبل [التاريخ] — [ما الذي يتوقّف عليه]
(وإن لم يكن هناك مطلوب هذا الأسبوع: «لا مطلوب منك هذا الأسبوع — كل شيء يسير كما ينبغي.»)
ما أُنجز هذا الأسبوع
• [...]
• [...]
تحت المتابعة
• [المسألة] — [أثرها على الجدول أو الميزانية] — [ما يجري فعله بشأنها]
(تُذكر المسائل مبكّراً. ما يُذكر في وقته يُحلّ، وما يُخفى يكبر.)
خطة الأسبوع القادم
• [...]
• [...]
لأي استفسار، يكفي الرد على هذا البريد.
تحياتي،
{{designer_name}}
{{designer_title}}
—
مفتاح الحالة: اكتب احله المشروع زي
يسير حسب الخطة · يحتاج انتباهاً · معرّض للتأخير$seedtxt$, 8),
  ($seedtxt$followup_6_months$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$6 months follow up$seedtxt$, $seedtxt$6 months follow up {{project_name}}$seedtxt$, $seedtxt$Hi {{client_first_name}},
It's been 6 months since {{project_name}} was handed over — and that's exactly the stretch of time that reveals what handover day can't.
If you have a moment, just two questions:
• What's working better than you expected?
• What's quietly annoying in daily use?
A line or two is plenty.
Notes from someone actually living in the space shape my decisions on the projects that follow more than you'd think.
This ia a deliberate part of how I work.
A design isn't finished at handover, it's finished when it proves itself in daily life.
And if anything needs a small adjustment, just tell me and I'll be glad to arrange it.
Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 9),
  ($seedtxt$followup_6_months$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$٦ شهور متابعه$seedtxt$, $seedtxt$متابعة بعد ٦ أشهر {{project_name}}$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
مرّت ستة أشهر على تسليم المشروع {{project_name}}، وهذه المدة تحديداً هي التي تكشف ما لا يظهر يوم التسليم
لو سمح الوقت، سؤالان فقط:
• ما الذي يعمل جيداً أكثر ممّا كان متوقّعاً؟
• وما الذي يسبّب إزعاجاً صغيراً في الاستخدام اليومي؟
سطران يكفيان تماماً.
ملاحظاتك  ستفيدني جدا من تطوير الخدمة المقدمة.
وهي جزء أصيل من طريقة عملي
التصميم لا ينتهي بالتسليم، بل بما يثبت أنه صالح للحياة اليومية.
وإن كان هناك ما يحتاج تعديلاً بسيطاً، يكفي إخباري ويسعدني ترتيب ذلك.
تحياتي،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 9),
  ($seedtxt$followup_1_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$1 year follow up$seedtxt$, $seedtxt$One year follow up  {{project_name}}$seedtxt$, $seedtxt$Hi {{client_first_name}},
It's been a year since {{project_name}}, and I hope you  have settled in the space.
Can I take few minutes to answer this question:
Is there a part of the space you now use differently than either of us expected?
That answer teaches me more than almost anything else, because it measures the design against life rather than against drawings.
If a next phase or another space is on your mind, I'm here whenever the timing suits.
Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 10),
  ($seedtxt$followup_1_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$سنه متابعة$seedtxt$, $seedtxt$متابعة بعد سنة$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
مرّ عام على {{project_name}}، وأتمنى أن يكون التصميم مريح لك.
سأخذ من وققتك دقيقة لتجيبيني عن هذا السؤال:
هل هناك جزء من المساحة يُستخدم اليوم بطريقة مختلفة عمّا كان متوقّعاً؟
الإجابة عن هذا السؤال تحديداً هي أكثر ما يطوّر عملي، لأنها تقيس التصميم بالحياة لا بالرسم.
وإن كانت في ذهنك مرحلة قادمة أو مساحة أخرى، فأنا هنا وقتما يناسب التوقيت.
تحياتي،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 10),
  ($seedtxt$followup_2_years$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$2 years follow up$seedtxt$, $seedtxt$2 years follow up {{project_name}}$seedtxt$, $seedtxt$Hi {{client_first_name}},
It's been 2 years since {{project_name}}. The 2-year mark is usually when things start to surface like -
An appetite for a small refresh, a room whose use has shifted as life changed, or an entirely new project.
If any of that is on the horizon, it's worth knowing that your project file is still complete on my side — the drawings, the FF&E schedule, the paint codes, and the supplier details.
Anything new picks up where we left off rather than starting from zero, which saves both time and money and keeps the space coherent, rather than looking like pieces were added to it later.
If nothing is on the horizon, then it is a pleasure knowing that you are doing well.
Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 11),
  ($seedtxt$followup_2_years$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$سنتين متابعة$seedtxt$, $seedtxt$متابعة بعد عامين$seedtxt$, $seedtxt$أهلاً {{client_first_name}}،
مرّ عامان على {{project_name}}. وما بعد العامين عادةً ما تبدأ أمور بالظهور مثل:
رغبة في تجديد بسيط، أو غرفة تغيّر استخدامها مع تغيّر الحياة، أو مشروع جديد بالكامل.
وإن كان أيٌّ من ذلك في الأفق، فمن المفيد أن تعرف أن ملف مشروعك محفوظ لديّ كاملاً: المخططات، وجدول الأثاث والتجهيزات، وأكواد الدهانات، وبيانات موردي الخامات.
أي عمل قادم يبدأ من حيث انتهينا لا من الصفر — وهذا يوفّر وقتاً ومالاً، ويحافظ على اتساق المساحة بدل أن تبدو وكأن قطعاً غريبة عنها أُضيفت إليها لاحقاً.
إن لم يكن هناك ما يستدعي شيئاً الآن، فيسعدني أن أتواصل معك.
تحياتي،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$seedtxt$, 11),
  ($seedtxt$occasion_hijri_new_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$Happy New Hijri Year, 🎉$seedtxt$, $seedtxt$Happy New Hijri Year, 🎉$seedtxt$, $seedtxt$Subject - Happy New Hijri Year, 🎉
Happy New Hijri Year, {{client_first_name}}.
A new Hijri year is here — may it bring goodness and success to you and your family.
Warm regards,
{{designer_name}}$seedtxt$, 12),
  ($seedtxt$occasion_hijri_new_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$هجري$seedtxt$, $seedtxt$هجري$seedtxt$, $seedtxt$عنوان- كل عام وأنت بخير 🎉
كل عام وأنت بخير {{client_first_name}},
سنة هجرية جديدة — أسأل الله أن تكون سنة خير وتوفيق عليك وعلى أهلك.
تحياتي،
{{designer_name}}$seedtxt$, 12),
  ($seedtxt$occasion_ramadan$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$Ramadan Kareem$seedtxt$, $seedtxt$Ramadan Kareem$seedtxt$, $seedtxt$Subject - Ramadan Kareem
Ramadan Kareem, {{client_first_name}}.
May this month bring you and your family blessings, good health, and peace of mind.
I hope the space is bringing you all together for suhoor and iftar, just as we imagined it would.
Ramadan Mubarak,
{{designer_name}}$seedtxt$, 13),
  ($seedtxt$occasion_ramadan$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$رمضان$seedtxt$, $seedtxt$رمضان$seedtxt$, $seedtxt$عنوان - رمضان كريم {{client_first_name}},
رمضان كريم {{client_first_name}}
أعاده الله عليك وعلى أهلك بالخير والصحة وراحة البال.
تذكّرت {{project_name}} وأنا أكتب لك — أتمنى أن تكون المساحة تجمعكم على السحور والإفطار كما تخيّلناها.
كل عام وأنتم بخير،
{{designer_name}}$seedtxt$, 13),
  ($seedtxt$occasion_eid_fitr$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$eid fitr$seedtxt$, $seedtxt$eid fitr$seedtxt$, $seedtxt$Subject - Eid Mubarak, {{client_first_name}}.
Eid Mubarak, {{client_first_name}}.
Wishing you and your family a joyful Eid, filled with health and happiness.
I hope the Eid days brings to you and your family joy and loving.
Warm regards,
{{designer_name}}$seedtxt$, 14),
  ($seedtxt$occasion_eid_fitr$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$عنوان- عيد مبارك 🎉$seedtxt$, $seedtxt$عنوان- عيد مبارك 🎉$seedtxt$, $seedtxt$عنوان- عيد مبارك 🎉
عيد مبارك {{client_first_name}},
كل عام وأنت وأهلك بخير. أعاده الله عليكم بالفرح والصحة.
تحياتي،
{{designer_name}}$seedtxt$, 14),
  ($seedtxt$occasion_eid_adha$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$eid adha$seedtxt$, $seedtxt$eid adha$seedtxt$, $seedtxt$Subject - Eid al-Adha Mubarak, {{client_first_name}}.
Eid al-Adha Mubarak, {{client_first_name}}.
May Allah accept from us and from you. Wishing you and your family calm, beautiful days.
Warm regards,
{{designer_name}}$seedtxt$, 15),
  ($seedtxt$occasion_eid_adha$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$عيد أضحى مبارك$seedtxt$, $seedtxt$عيد أضحى مبارك$seedtxt$, $seedtxt$عنوان - عيد أضحى مبارك {{client_first_name}}🎉
عيد أضحى مبارك {{client_first_name}}
تقبّل الله منّا ومنكم، وكل عام وأنتم بخير.
أتمنى لك ولأهلك أيامًا هادئة وجميلة.
تحياتي،
{{designer_name}}$seedtxt$, 15),
  ($seedtxt$occasion_new_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'en'::public.app_language, $seedtxt$new year$seedtxt$, $seedtxt$new year$seedtxt$, $seedtxt$Subject - Happy New Year, {{client_first_name}} 🎉
Happy New Year, {{client_first_name}} 🎉
Wishing you a wonderful year ahead — and I hope the space we worked on at {{project_name}} keeps adding something good to your days.
Warm regards,
{{designer_name}}$seedtxt$, 16),
  ($seedtxt$occasion_new_year$seedtxt$, 'message'::public.template_type, 'email'::public.template_channel, $seedtxt$10_followup$seedtxt$, 'ar'::public.app_language, $seedtxt$عام جديد$seedtxt$, $seedtxt$عام جديد$seedtxt$, $seedtxt$عنوان - كل عام و انت بخير {{client_first_name}} 🎉
كل عام و انت بخير {{client_first_name}} 🎉
أتمنى لك سنة سعيدة و جميلة،
تحياتي،
{{designer_name}}$seedtxt$, 16)
on conflict (key, language) do update set
  type       = excluded.type,
  channel    = excluded.channel,
  stage      = excluded.stage,
  title      = excluded.title,
  subject    = excluded.subject,
  body       = excluded.body,
  sort_order = excluded.sort_order;


insert into public.questionnaire_library (key, structure)
values ($seedtxt$client_questionnaire$seedtxt$, $seedtxt${"key": "client_questionnaire", "type": "questionnaire", "sections": [{"number": "01", "title_en": "General Information", "title_ar": "معلومات عامة", "desc_en": null, "desc_ar": null, "show_if_project_has": null, "questions": [{"key": "s01_q1", "type": "text", "label_en": "Name:", "label_ar": "الاسم:", "text_en": null, "text_ar": null, "options": []}, {"key": "s01_q2", "type": "text", "label_en": "Address:", "label_ar": "العنوان:", "text_en": null, "text_ar": null, "options": []}, {"key": "s01_q3", "type": "text", "label_en": "Phone:", "label_ar": "رقم الهاتف:", "text_en": null, "text_ar": null, "options": []}, {"key": "s01_q4", "type": "text", "label_en": "Email:", "label_ar": "البريد الإلكتروني:", "text_en": null, "text_ar": null, "options": []}]}, {"number": "02", "title_en": "Project Overview", "title_ar": "نظرة عامة على المشروع", "desc_en": null, "desc_ar": null, "show_if_project_has": null, "questions": [{"key": "s02_q1", "type": "text", "label_en": "Budget", "label_ar": "الميزانية", "text_en": "What is your approximate total budget for this project (including furniture and design fees)?", "text_ar": "ما الميزانية التقريبية الإجمالية للمشروع، شاملةً الأثاث وأتعاب التصميم؟", "options": []}, {"key": "s02_q2", "type": "text", "label_en": "Timeline", "label_ar": "التوقيت", "text_en": "What is your ideal start date, and your timeline for completion?", "text_ar": "ما التاريخ المفضّل للبدء، والمدة المتوقّعة حتى الانتهاء؟", "options": []}, {"key": "s02_q3", "type": "text", "label_en": "Lifestyle", "label_ar": "نمط الحياة", "text_en": "How would you describe your lifestyle? (e.g. homebodies, active, entertain often, pets or young children)", "text_ar": "كيف تصف نمط حياتك اليومي؟ (مثل: البقاء في المنزل غالبًا، حياة نشطة، استقبال ضيوف بكثرة، وجود حيوانات أليفة أو أطفال صغار)", "options": []}, {"key": "s02_q4", "type": "text", "label_en": "Household", "label_ar": "أفراد المنزل", "text_en": "Who lives in your home, and what are their ages?", "text_ar": "من يقيم في المنزل، وما أعمارهم؟", "options": []}, {"key": "s02_q5", "type": "text", "label_en": "Accessibility", "label_ar": "احتياجات الوصول", "text_en": "Do you have any accessibility needs we should be aware of?", "text_ar": "هل هناك احتياجات خاصة بسهولة الحركة أو الوصول ينبغي مراعاتها؟", "options": []}]}, {"number": "03", "title_en": "Personal Preferences", "title_ar": "التفضيلات الشخصية", "desc_en": null, "desc_ar": null, "show_if_project_has": null, "questions": [{"key": "s03_q1", "type": "text", "label_en": "Aesthetic", "label_ar": "الطراز", "text_en": "How would you describe your design style? (e.g. modern, traditional, Hamptons, coastal, relaxed)", "text_ar": "كيف تصف الطراز الذي تفضّله؟ (مثل: مودرن، كلاسيك، ساحلي، بسيط ومريح)", "options": []}, {"key": "s03_q2", "type": "text", "label_en": "Colors", "label_ar": "الألوان", "text_en": "Are there any colors that you love or dislike?", "text_ar": "هل هناك ألوان تحبها أو ألوان تفضّل تجنّبها؟", "options": []}, {"key": "s03_q3", "type": "text", "label_en": "Materials", "label_ar": "الخامات", "text_en": "Do you have preferred materials or finishes — or any you would rather avoid?", "text_ar": "هل لديك خامات أو تشطيبات مفضّلة — أو أخرى تفضّل تجنّبها؟", "options": []}, {"key": "s03_q4", "type": "text", "label_en": "Existing pieces", "label_ar": "القطع الحالية", "text_en": "Do you have existing furniture or decor you would like incorporated into the design? If the list is long, simply write \"yes\" and we can discuss it in person.", "text_ar": "هل لديك أثاث أو قطع ديكور ترغب في دمجها ضمن التصميم؟ إن كانت القائمة طويلة، اكتب «نعم» فقط ونناقشها معًا.", "options": []}, {"key": "s03_q5", "type": "text", "label_en": "Functionality", "label_ar": "الأداء الوظيفي", "text_en": "Describe the ideal functionality of your new home. (e.g. plenty of storage, workspaces for two people, entertaining space, media room — how does your family live?)", "text_ar": "صف الأداء الوظيفي المثالي لمنزلك الجديد. (مثل: تخزين وفير، أماكن عمل لشخصين، مساحة لاستقبال الضيوف، غرفة وسائط — كيف تعيش الأسرة داخل المنزل؟)", "options": []}]}, {"number": "04", "title_en": "Kitchen", "title_ar": "المطبخ", "desc_en": "These questions relate to your kitchen design and preferences.", "desc_ar": "أسئلة تتعلق بتصميم المطبخ وتفضيلاته.", "show_if_project_has": "kitchen", "questions": [{"key": "s04_q1", "type": "text", "label_en": "Appliances", "label_ar": "الأجهزة", "text_en": "Do you have preferred appliance brands? (e.g. Sub-Zero, Liebherr, Smeg, Fisher & Paykel)", "text_ar": "هل لديك ماركات مفضّلة للأجهزة؟ (مثل: Sub-Zero، Liebherr، Smeg، Fisher & Paykel)", "options": []}, {"key": "s04_q2", "type": "checkbox", "label_en": "Features", "label_ar": "المواصفات", "text_en": "Select any features you would ideally like included in your kitchen:", "text_ar": "اختر ما ترغب في توفّره داخل المطبخ:", "options": [{"en": "Walk-in pantry", "ar": "غرفة مؤن منفصلة"}, {"en": "Plenty of storage", "ar": "تخزين وفير"}, {"en": "Insinkerator", "ar": "مفرمة نفايات بالحوض"}, {"en": "Zip tap (or similar)", "ar": "صنبور ماء فوري (أو ما يعادله)"}, {"en": "Integrated fridge / freezer", "ar": "ثلاجة/فريزر مدمجة"}, {"en": "Integrated coffee machine", "ar": "ماكينة قهوة مدمجة"}, {"en": "Wine fridge", "ar": "ثلاجة نبيذ"}, {"en": "Integrated dishwasher", "ar": "غسالة أطباق مدمجة"}, {"en": "Second dishwasher", "ar": "غسالة أطباق ثانية"}, {"en": "Multi-sort waste bin", "ar": "سلة نفايات بفواصل للفرز"}, {"en": "Second fridge", "ar": "ثلاجة إضافية"}, {"en": "Study nook", "ar": "ركن مكتبي صغير"}, {"en": "Integrated microwave", "ar": "ميكروويف مدمج"}, {"en": "Gas cooktop", "ar": "بوتاجاز غاز"}, {"en": "Induction cooktop", "ar": "سطح طهي بالحث (إندكشن)"}, {"en": "Double oven", "ar": "فرن مزدوج"}, {"en": "Steam oven", "ar": "فرن بخاري"}, {"en": "Warming drawer", "ar": "درج تسخين"}, {"en": "Bar / bar nook", "ar": "ركن بار"}, {"en": "iPad or phone charging station", "ar": "محطة شحن للهاتف أو التابلت"}, {"en": "No sink in the island bench", "ar": "بدون حوض في الجزيرة الوسطى"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}]}, {"key": "s04_q3", "type": "text", "label_en": "Preferences", "label_ar": "تفضيلات", "text_en": "Do you have any specific preferences for your kitchen? (e.g. marble countertop, all white, plenty of storage)", "text_ar": "هل لديك تفضيلات محددة للمطبخ؟ (مثل: سطح رخامي، أبيض بالكامل، تخزين وفير)", "options": []}]}, {"number": "05", "title_en": "Laundry", "title_ar": "غرفة الغسيل", "desc_en": "These questions relate to your laundry design and preferences.", "desc_ar": "أسئلة تتعلق بتصميم غرفة الغسيل وتفضيلاتها.", "show_if_project_has": "laundry", "questions": [{"key": "s05_q1", "type": "text", "label_en": "Functionality", "label_ar": "الأداء الوظيفي", "text_en": "Do you have specific functionality needs for your laundry? (e.g. plenty of storage, mudroom, pull-out ironing board)", "text_ar": "هل لديك احتياجات وظيفية محددة لغرفة الغسيل؟ (مثل: تخزين وفير، مدخل خدمي، طاولة كي قابلة للسحب)", "options": []}, {"key": "s05_q2", "type": "checkbox", "label_en": "Features", "label_ar": "المواصفات", "text_en": "Select any features you would ideally like included in your laundry:", "text_ar": "اختر ما ترغب في توفّره داخل غرفة الغسيل:", "options": [{"en": "New washing machine", "ar": "غسالة جديدة"}, {"en": "Existing washing machine", "ar": "غسالة حالية"}, {"en": "New dryer", "ar": "مجفف جديد"}, {"en": "Existing dryer", "ar": "مجفف حالي"}, {"en": "Plumbing for dryer", "ar": "تمديدات صرف للمجفف"}, {"en": "Storage for linen", "ar": "تخزين للمفروشات"}, {"en": "Storage for pet food", "ar": "تخزين لطعام الحيوانات الأليفة"}, {"en": "Built-in pet crate", "ar": "قفص مدمج للحيوان الأليف"}, {"en": "Built-in pet feeding station", "ar": "ركن مدمج لإطعام الحيوان الأليف"}, {"en": "School bag storage", "ar": "تخزين لحقائب المدرسة"}, {"en": "Standard sink mixer", "ar": "خلاط حوض عادي"}, {"en": "Pull-out sink mixer", "ar": "خلاط حوض قابل للسحب"}, {"en": "Laundry sorting bins", "ar": "سلال لفرز الغسيل"}, {"en": "Wall-mounted drying rack", "ar": "حبل أو رف تنشيف مثبّت بالحائط"}, {"en": "Storage for buckets", "ar": "تخزين لأدوات التنظيف"}, {"en": "Storage for sporting equipment", "ar": "تخزين لمعدات رياضية"}, {"en": "Laundry chute", "ar": "منزلق غسيل بين الأدوار"}, {"en": "Pull-out ironing board", "ar": "طاولة كي قابلة للسحب"}, {"en": "Tall storage for ironing board", "ar": "خزانة طولية لطاولة الكي"}, {"en": "Stick vacuum charging station", "ar": "محطة شحن للمكنسة العمودية"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}]}, {"key": "s05_q3", "type": "text", "label_en": "Preferences", "label_ar": "تفضيلات", "text_en": "Do you have specific design requests? (e.g. colors you like, preferred tile or countertop surface)", "text_ar": "هل لديك طلبات تصميمية محددة؟ (مثل: ألوان تفضّلها، نوع البلاط أو سطح العمل)", "options": []}]}, {"number": "06", "title_en": "Ensuite", "title_ar": "حمام الغرفة الرئيسية", "desc_en": "These questions relate to your ensuite design and preferences.", "desc_ar": "أسئلة تتعلق بتصميم حمام الغرفة الرئيسية وتفضيلاته.", "show_if_project_has": "ensuite", "questions": [{"key": "s06_q1", "type": "text", "label_en": "Functionality", "label_ar": "الأداء الوظيفي", "text_en": "Do you have specific functionality needs for your ensuite? (e.g. particular storage requests, walk-in shower)", "text_ar": "هل لديك احتياجات وظيفية محددة لحمام الغرفة الرئيسية؟ (مثل: طلبات تخزين معينة، كابينة استحمام بلا حاجز)", "options": []}, {"key": "s06_q2", "type": "checkbox", "label_en": "Features", "label_ar": "المواصفات", "text_en": "Select any features you would ideally like included in your ensuite:", "text_ar": "اختر ما ترغب في توفّره داخل الحمام:", "options": [{"en": "Single basin", "ar": "حوض غسيل مفرد"}, {"en": "Double basins", "ar": "حوضا غسيل"}, {"en": "Free-standing toilet", "ar": "مرحاض قائم"}, {"en": "Concealed cistern toilet", "ar": "مرحاض بخزان مخفي"}, {"en": "No preference on toilet type", "ar": "لا تفضيل لنوع المرحاض"}, {"en": "Overhead storage", "ar": "خزائن علوية"}, {"en": "Under-sink / drawer storage", "ar": "تخزين أسفل الحوض أو أدراج"}, {"en": "Linen cupboard or tall storage", "ar": "دولاب طولي للمفروشات"}, {"en": "Underfloor heating", "ar": "تدفئة أرضية"}, {"en": "Heated towel rail", "ar": "حامل مناشف مُدفّأ"}, {"en": "Full-length mirror", "ar": "مرآة بطول كامل"}, {"en": "Robe hooks", "ar": "علاقات للأرواب"}, {"en": "Free-standing bath", "ar": "بانيو قائم"}, {"en": "Integrated bath", "ar": "بانيو مدمج"}, {"en": "No bath", "ar": "بدون بانيو"}, {"en": "Niche in shower", "ar": "رف غائر داخل الاستحمام"}, {"en": "Handheld shower", "ar": "دش يدوي"}, {"en": "Single shower", "ar": "كابينة استحمام مفردة"}, {"en": "Double shower", "ar": "كابينة استحمام مزدوجة"}, {"en": "Overhead heat lamps", "ar": "مصابيح تدفئة علوية"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}]}, {"key": "s06_q3", "type": "text", "label_en": "Preferences", "label_ar": "تفضيلات", "text_en": "Do you have specific design requests? (e.g. colors you like, preferred tiles or fixtures)", "text_ar": "هل لديك طلبات تصميمية محددة؟ (مثل: ألوان تفضّلها، البلاط أو الأطقم الصحية)", "options": []}]}, {"number": "07", "title_en": "Bathrooms", "title_ar": "باقي الحمامات", "desc_en": "These questions relate to the design and preferences for your other bathrooms.", "desc_ar": "أسئلة تتعلق بتصميم باقي حمامات المنزل وتفضيلاتها.", "show_if_project_has": "bathrooms", "questions": [{"key": "s07_q1", "type": "text", "label_en": "Functionality", "label_ar": "الأداء الوظيفي", "text_en": "Do you have specific functionality needs for the bathrooms? (e.g. particular storage requests)", "text_ar": "هل لديك احتياجات وظيفية محددة لباقي الحمامات؟ (مثل: طلبات تخزين معينة)", "options": []}, {"key": "s07_q2", "type": "checkbox", "label_en": "Features", "label_ar": "المواصفات", "text_en": "Select any features you would ideally like included in your bathrooms:", "text_ar": "اختر ما ترغب في توفّره داخل الحمامات:", "options": [{"en": "Single basin", "ar": "حوض غسيل مفرد"}, {"en": "Double basins", "ar": "حوضا غسيل"}, {"en": "Free-standing toilet", "ar": "مرحاض قائم"}, {"en": "Concealed cistern toilet", "ar": "مرحاض بخزان مخفي"}, {"en": "No preference on toilet type", "ar": "لا تفضيل لنوع المرحاض"}, {"en": "Overhead storage", "ar": "خزائن علوية"}, {"en": "Under-sink / drawer storage", "ar": "تخزين أسفل الحوض أو أدراج"}, {"en": "Linen cupboard or tall storage", "ar": "دولاب طولي للمفروشات"}, {"en": "Underfloor heating", "ar": "تدفئة أرضية"}, {"en": "Heated towel rail", "ar": "حامل مناشف مُدفّأ"}, {"en": "Full-length mirror", "ar": "مرآة بطول كامل"}, {"en": "Robe hooks", "ar": "علاقات للأرواب"}, {"en": "Free-standing bath", "ar": "بانيو قائم"}, {"en": "Integrated bath", "ar": "بانيو مدمج"}, {"en": "No bath", "ar": "بدون بانيو"}, {"en": "Niche in shower", "ar": "رف غائر داخل الاستحمام"}, {"en": "Handheld shower", "ar": "دش يدوي"}, {"en": "Single shower", "ar": "كابينة استحمام مفردة"}, {"en": "Double shower", "ar": "كابينة استحمام مزدوجة"}, {"en": "Overhead heat lamps", "ar": "مصابيح تدفئة علوية"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}]}, {"key": "s07_q3", "type": "text", "label_en": "Preferences", "label_ar": "تفضيلات", "text_en": "Do you have specific design requests? (e.g. colors you like, preferred tiles or fixtures)", "text_ar": "هل لديك طلبات تصميمية محددة؟ (مثل: ألوان تفضّلها، البلاط أو الأطقم الصحية)", "options": []}]}, {"number": "08", "title_en": "Other Areas", "title_ar": "باقي المساحات", "desc_en": "These questions relate to the design and preferences for the other areas of your home.", "desc_ar": "أسئلة تتعلق بتصميم باقي مساحات المنزل وتفضيلاتها.", "show_if_project_has": null, "questions": [{"key": "s08_q1", "type": "text", "label_en": "Functionality", "label_ar": "الأداء الوظيفي", "text_en": "Do you have specific functionality needs for the home? (e.g. toy storage, visibility to the pool, size of the dining table)", "text_ar": "هل لديك احتياجات وظيفية محددة للمنزل؟ (مثل: تخزين ألعاب الأطفال، إطلالة على حمام السباحة، حجم طاولة الطعام)", "options": []}, {"key": "s08_q2", "type": "checkbox", "label_en": "Features", "label_ar": "المواصفات", "text_en": "Select any features you would ideally like included in your home:", "text_ar": "اختر ما ترغب في توفّره داخل المنزل:", "options": [{"en": "Ceiling fans", "ar": "مراوح سقف"}, {"en": "Video security system", "ar": "نظام مراقبة بالفيديو"}, {"en": "Skylights", "ar": "فتحات إضاءة سقفية"}, {"en": "Built-in safe for valuables", "ar": "خزنة مدمجة للمقتنيات الثمينة"}, {"en": "Fireplace", "ar": "مدفأة"}, {"en": "Smart home features", "ar": "أنظمة المنزل الذكي"}, {"en": "Home office for one", "ar": "مكتب منزلي لشخص واحد"}, {"en": "Home office for two", "ar": "مكتب منزلي لشخصين"}, {"en": "Pet-friendly features", "ar": "عناصر مناسبة للحيوانات الأليفة"}, {"en": "Artwork lighting / display", "ar": "إضاءة لعرض الأعمال الفنية"}, {"en": "Plantation shutters", "ar": "شيش خارجي (بلانتيشن)"}, {"en": "Carpet in bedrooms", "ar": "موكيت في غرف النوم"}, {"en": "No carpet in bedrooms", "ar": "بدون موكيت في غرف النوم"}, {"en": "Gym / exercise area", "ar": "مساحة رياضية أو صالة تمارين"}, {"en": "Playroom", "ar": "غرفة لعب للأطفال"}, {"en": "Media / movie room", "ar": "غرفة وسائط أو سينما منزلية"}, {"en": "Recreation room", "ar": "غرفة ترفيه"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}, {"en": "Other: ______________________", "ar": "أخرى: ______________________"}]}, {"key": "s08_q3", "type": "text", "label_en": "Preferences", "label_ar": "تفضيلات", "text_en": "Do you have specific design requests? (e.g. colors you like, flooring preferences, paint colors)", "text_ar": "هل لديك طلبات تصميمية محددة؟ (مثل: ألوان تفضّلها، نوع الأرضيات، ألوان الدهانات)", "options": []}]}, {"number": "09", "title_en": "Room Details", "title_ar": "تفاصيل الغرف", "desc_en": "Leave blank anything that is not relevant to your project.", "desc_ar": "اترك ما لا ينطبق على مشروعك دون إجابة.", "show_if_project_has": null, "questions": [{"key": "s09_q1", "type": "text", "label_en": "Master bedroom", "label_ar": "غرفة النوم الرئيسية", "text_en": "What size bed do you prefer in the master bedroom? (king, queen, etc.)", "text_ar": "ما مقاس السرير الذي تفضّله في الغرفة الرئيسية؟ (كينج، كوين، إلخ)", "options": []}, {"key": "s09_q2", "type": "text", "label_en": "Dining", "label_ar": "الطعام", "text_en": "How many people should your dining table comfortably seat?", "text_ar": "كم شخصًا ينبغي أن تتّسع له طاولة الطعام بشكل مريح؟", "options": []}, {"key": "s09_q3", "type": "text", "label_en": "Workspaces", "label_ar": "أماكن العمل", "text_en": "Do you want dedicated workspaces in any of the bedrooms?", "text_ar": "هل ترغب في مساحة عمل مخصصة داخل أي من غرف النوم؟", "options": []}, {"key": "s09_q4", "type": "text", "label_en": "Living room", "label_ar": "غرفة المعيشة", "text_en": "How much seating do you want in the living room?", "text_ar": "كم عدد أماكن الجلوس التي ترغب بها في غرفة المعيشة؟", "options": []}, {"key": "s09_q5", "type": "text", "label_en": "Storage", "label_ar": "التخزين", "text_en": "Do you need built-in storage? If so, what for? (e.g. a book collection)", "text_ar": "هل تحتاج إلى تخزين مدمج؟ ولأي غرض؟ (مثل: مكتبة كتب)", "options": []}, {"key": "s09_q6", "type": "text", "label_en": "Lighting", "label_ar": "الإضاءة", "text_en": "Do you have specific lighting preferences? (e.g. dimmers)", "text_ar": "هل لديك تفضيلات محددة للإضاءة؟ (مثل: مفاتيح تعتيم)", "options": []}, {"key": "s09_q7", "type": "text", "label_en": "Technology", "label_ar": "التقنية", "text_en": "Do you have any specific technology requests? (e.g. a gaming setup)", "text_ar": "هل لديك طلبات تقنية محددة؟ (مثل: ركن ألعاب إلكترونية)", "options": []}, {"key": "s09_q8", "type": "text", "label_en": "Flooring", "label_ar": "الأرضيات", "text_en": "What type of flooring do you prefer?", "text_ar": "ما نوع الأرضيات الذي تفضّله؟", "options": []}, {"key": "s09_q9", "type": "text", "label_en": "Special pieces", "label_ar": "قطع خاصة", "text_en": "Are there specific pieces that need to be accommodated? (e.g. family heirlooms, collections, artwork)", "text_ar": "هل هناك قطع بعينها يجب استيعابها في التصميم؟ (مثل: مقتنيات عائلية، مجموعات، أعمال فنية)", "options": []}]}, {"number": "10", "title_en": "Anything Else", "title_ar": "ملاحظات إضافية", "desc_en": "Use this page for any other details or requests not yet covered.", "desc_ar": "استخدم هذه الصفحة لأي تفاصيل أو طلبات لم تُذكر سابقًا.", "show_if_project_has": null, "questions": [{"key": "s10_q1", "type": "text", "label_en": "Additional notes", "label_ar": "ملاحظات", "text_en": "List any other requests or information not yet covered.", "text_ar": "اذكر أي طلبات أو معلومات أخرى لم تُغطَّ في الاستمارة.", "options": []}]}]}$seedtxt$::jsonb)
on conflict (key) do update set structure = excluded.structure;


-- Seed every workspace that already exists.
do $$
declare ws uuid;
begin
  for ws in select id from public.workspaces loop
    perform public.seed_workspace_templates(ws);
  end loop;
end;
$$;
