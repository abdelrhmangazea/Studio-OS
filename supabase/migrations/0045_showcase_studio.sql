-- =============================================================
-- 0045 — A studio that has been running for a year.
--
-- The eleven-project demo covers every stage once, which is right for
-- a classroom. It is wrong for a sales demo: a prospect looking at one
-- project per stage sees a template, not a business. This adds twenty
-- more projects on top of the standard demo — two to four in every
-- stage, each a different situation: a first payment thirty-two days
-- late, a client abroad with the site on hold, a proposal nobody has
-- answered, a delivered villa whose final invoice is still open, a
-- second design revision the client asked for through the portal.
-- Thirty-eight invoices across the year, fourteen tasks (six of them
-- overdue), forty notes, site-visit time logs, follow-up reminders,
-- and a dozen leads that went nowhere — because a real year has those.
--
-- Rows are demo rows (is_demo), so the demo reset removes them with
-- everything else and the classroom safety rules still apply. The
-- badge that marks them is hidden per workspace by the new
-- studio_settings.hide_demo_badge — set by hand, for a workspace
-- whose only purpose is showing the product. Not a user setting.
--
-- Same rules as 0042: every fixed-size write asserts its row count.
-- Idempotent: a second call on a workspace that already has the
-- showcase is a no-op.
-- =============================================================

alter table public.studio_settings
  add column if not exists hide_demo_badge boolean not null default false;

create or replace function public.showcase_seed(p_ws uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v record;
  cid uuid; pid uuid; owner_id uuid; session_id uuid;
  st_new uuid; st_contacted uuid; st_f1 uuid; st_f2 uuid; st_won uuid; st_rejected uuid; st_lost uuid;
  src_ig uuid; src_wa uuid; src_web uuid; src_ref uuid; src_walk uuid;
  n int; made int := 0;
  rate numeric := 2200;   -- EGP per m², the studio's going rate this year
begin
  if exists (select 1 from public.contacts
              where workspace_id = p_ws and is_demo and first_name = 'ريهام' and last_name = 'عبد العال') then
    return jsonb_build_object('skipped', true);
  end if;

  if not exists (select 1 from public.projects where workspace_id = p_ws and is_demo) then
    raise exception 'showcase: load the standard demo first';
  end if;

  select p.id into owner_id from public.profiles p
   where p.workspace_id = p_ws and p.role = 'owner' limit 1;
  select id into session_id from public.session_types
   where workspace_id = p_ws and active order by sort_order limit 1;

  select id into st_new       from public.lead_statuses where workspace_id=p_ws and label_en='New' limit 1;
  select id into st_contacted from public.lead_statuses where workspace_id=p_ws and label_en='Contacted' limit 1;
  select id into st_f1        from public.lead_statuses where workspace_id=p_ws and label_en='Follow-up 1' limit 1;
  select id into st_f2        from public.lead_statuses where workspace_id=p_ws and label_en='Follow-up 2' limit 1;
  select id into st_won       from public.lead_statuses where workspace_id=p_ws and is_won order by sort_order limit 1;
  select id into st_rejected  from public.lead_statuses where workspace_id=p_ws and label_en='Rejected' limit 1;
  select id into st_lost      from public.lead_statuses where workspace_id=p_ws and label_en='Not interested' limit 1;

  select id into src_ig   from public.lead_sources where workspace_id=p_ws and label_en='Instagram' limit 1;
  select id into src_wa   from public.lead_sources where workspace_id=p_ws and label_en='WhatsApp'  limit 1;
  select id into src_web  from public.lead_sources where workspace_id=p_ws and label_en='Website'   limit 1;
  select id into src_ref  from public.lead_sources where workspace_id=p_ws and label_en='Referral'  limit 1;
  select id into src_walk from public.lead_sources where workspace_id=p_ws and label_en='Walk-in'   limit 1;

  create temp table sc (
    k text primary key, cid uuid, pid uuid, value numeric,
    stage_no int, age int, recent int, delivered int
  ) on commit drop;

  -- ---------------------------------------------------------------
  -- 1. Twenty clients and their projects
  --    k · first · last · email · cc · phone · country · source ·
  --    project · address · m² · type · brief · stage · state ·
  --    age (days since first contact) · recent (days since the last
  --    stage closed) · delivered (days ago, or null) · done items in
  --    the open stage
  -- ---------------------------------------------------------------
  for v in
    select * from (values
      ('A','ريهام','عبد العال','reham.a@example.com','+20','1055502001','EG','ig',
       'شقة جاردن سيتي','جاردن سيتي، القاهرة',195,'شقة سكنية',
       'شقة 195 م² في عمارة قديمة بأسقف عالية. العميلة عايزة تحافظ على الطابع الكلاسيكي وتضيف مطبخ مفتوح. الاستشارة محجوزة بعد يومين.',
       '01_consultation','on_track',5,5,null,0),
      ('B','خالد','المنصوري','khaled.m@example.com','+971','505552002','AE','ref',
       'فيلا مدينة خليفة','مدينة خليفة، أبوظبي',560,'فيلا',
       'فيلا 560 م² على العظم. مجلس منفصل، صالة عائلية، وحديقة خلفية بجلسة خارجية. العميل اتحوّل من ترشيح عميل قديم. عرض الأتعاب اتبعت من 9 أيام.',
       '02_fee_proposal','waiting_client',21,9,null,1),
      ('C','سلمى','فريد','salma.f@example.com','+20','1155502003','EG','web',
       'شقة الرحاب','الرحاب، القاهرة الجديدة',160,'شقة سكنية',
       'شقة 160 م² لعروسين. الميزانية محدودة والعميلة طلبت عرض على مرحلتين. العرض اتبعت من أكتر من 3 أسابيع ومفيش رد.',
       '02_fee_proposal','needs_attention',38,24,null,1),
      ('D','ماجد','الشهري','majed.s@example.com','+966','555552004','SA','ig',
       'قصر حي النرجس','حي النرجس، الرياض',900,'فيلا',
       'قصر 900 م² على ثلاث أدوار. مجلسين، صالة طعام لـ 24 فرد، وجناح رئيسي بحديقة داخلية. العقد موقّع من شهر والدفعة الأولى لسه ما وصلتش.',
       '03_contract','needs_attention',52,32,null,1),
      ('E','نهى','السيد','noha.s@example.com','+20','1255502005','EG','wa',
       'شقة مصر الجديدة','مصر الجديدة، القاهرة',230,'شقة سكنية',
       'شقة 230 م² دور تاني. أسرة بثلاث أطفال، الأولوية للأمان والتخزين. العقد اتبعت للتوقيع الأسبوع اللي فات.',
       '03_contract','waiting_client',30,6,null,0),
      ('F','عبدالله','الكندري','abdullah.k@example.com','+965','555552006','KW','ref',
       'شاليه الخيران','الخيران، الكويت',260,'شاليه',
       'شاليه 260 م² على البحر. طابع بحري بسيط، خامات تستحمل الرطوبة والملح. الدفعة الأولى وصلت وحقيبة الترحيب اتبعتت.',
       '04_onboarding','on_track',40,4,null,3),
      ('G','ياسمين','حلمي','yasmin.h@example.com','+20','1055502007','EG','ig',
       'شقة زايد الجديدة','الشيخ زايد، الجيزة',175,'شقة سكنية',
       'شقة 175 م² في كمبوند جديد. العميلة مشغولة وما ردتش على استبيان الاستقبال من 12 يوم.',
       '04_onboarding','waiting_client',48,12,null,1),
      ('H','راشد','النعيمي','rashed.n@example.com','+971','555552008','AE','web',
       'بنتهاوس جميرا','جميرا، دبي',420,'بنتهاوس',
       'بنتهاوس 420 م² بتراس 90 م². إطلالة بحرية، العميل عايز الداخل يكمّل الخارج. الكونسبت شغال حالياً.',
       '05_concept','on_track',70,8,null,4),
      ('I','مها','القاسمي','maha.q@example.com','+971','505552009','AE','ig',
       'صالون تجميل الشارقة','المجاز، الشارقة',140,'صالون',
       'صالون 140 م²، 6 كراسي وغرفتين خاصة. الهوية وردي فاتح ونحاسي. الكونسبت اتنشر على البوابة من 8 أيام ومستني الاعتماد.',
       '05_concept','waiting_client',64,8,null,5),
      ('J','حسن','عرفة','hassan.a@example.com','+20','1155502010','EG','ref',
       'فيلا بالم هيلز','بالم هيلز، 6 أكتوبر',480,'فيلا',
       'فيلا 480 م² بحمام سباحة. مودرن دافي، خشب وحجر. تطوير التصميم في نصه ورسومات الإضاءة جاهزة للاعتماد.',
       '06_design_development','on_track',95,6,null,5),
      ('K','لينا','دياب','lina.d@example.com','+20','1255502011','EG','wa',
       'مكتب محاماة الدقي','الدقي، الجيزة',210,'مكتب',
       'مكتب 210 م²، 4 غرف محامين وقاعة اجتماعات ومكتبة. العميلة طلبت تعديلين من البوابة، والدفعة التانية متأخرة من 40 يوم.',
       '06_design_development','needs_attention',110,40,null,3),
      ('L','سعود','العجمي','saud.a@example.com','+965','505552012','KW','web',
       'فيلا الوفرة','الوفرة، الكويت',380,'فيلا',
       'فيلا 380 م² مزرعة. جلسات خارجية كبيرة ومطبخ خارجي. جمعنا 3 عروض نجارة و2 رخام.',
       '07_tender_ffe','on_track',130,10,null,4),
      ('M','دعاء','شاهين','doaa.s@example.com','+20','1055502013','EG','ig',
       'شقة ماونتن فيو','ماونتن فيو، القاهرة الجديدة',200,'شقة سكنية',
       'شقة 200 م². العميلة بتختار بين عرضين نجارة من أسبوعين والفرق بينهم 18٪.',
       '07_tender_ffe','waiting_client',140,15,null,6),
      ('N','طلال','الحربي','talal.h@example.com','+966','505552014','SA','ref',
       'فيلا حي الملقا','حي الملقا، الرياض',650,'فيلا',
       'فيلا 650 م². التنفيذ شغال من 3 شهور، الجبس خلص والدهانات بدأت. زيارة موقع أسبوعية.',
       '08_construction','on_track',200,12,null,5),
      ('O','إيمان','عثمان','eman.o@example.com','+20','1155502015','EG','ig',
       'شقة المهندسين','المهندسين، الجيزة',185,'شقة سكنية',
       'شقة 185 م². العميلة مسافرة 3 شهور وطلبت نوقف التنفيذ لحد ما ترجع. الموقع مقفول والخامات مخزّنة.',
       '08_construction','on_hold',180,35,null,3),
      ('P','عمرو','البنا','amr.b@example.com','+20','1255502016','EG','web',
       'مطعم مارينا','مارينا، الساحل الشمالي',320,'مطعم',
       'مطعم 320 م² سعة 90 كرسي. لازم يفتح قبل الصيف. الدفعة التالتة متأخرة من 25 يوم والمقاول واقف.',
       '08_construction','needs_attention',165,25,null,4),
      ('Q','غادة','المري','ghada.m@example.com','+974','555552017','QA','ref',
       'فيلا الوعب','الوعب، الدوحة',540,'فيلا',
       'فيلا 540 م². اتسلمت من 3 أسابيع والعميلة مبسوطة جداً. الفاتورة النهائية اتدفعت. محتاجين نصوّر المشروع.',
       '09_delivered','on_track',260,20,20,6),
      ('R','مصطفى','كامل','mostafa.k@example.com','+20','1055502018','EG','ig',
       'دوبلكس الشروق','الشروق، القاهرة',290,'دوبلكس',
       'دوبلكس 290 م². اتسلم من شهر ونص. الفاتورة النهائية اتبعتت يوم التسليم ولسه ما اتدفعتش.',
       '09_delivered','on_track',240,45,45,4),
      ('S','نوف','السبيعي','nouf.s@example.com','+966','555552019','SA','wa',
       'شقة حي الياسمين','حي الياسمين، الرياض',220,'شقة سكنية',
       'شقة 220 م². اتسلمت من 5 شهور. متابعة الـ 6 شهور قرّبت.',
       '10_followup','on_track',330,155,155,2),
      ('T','كريم','منصور','karim.m@example.com','+20','1155502020','EG','ref',
       'فيلا كمبوند اللوتس','اللوتس، القاهرة الجديدة',450,'فيلا',
       'فيلا 450 م². اتسلمت من 11 شهر. العميل رشّح عميلين بعدها. متابعة السنة الشهر الجاي.',
       '10_followup','on_track',400,335,335,3)
    ) as x(k, fn, ln, email, cc, phone, country, src, pname, addr, area, ptype, brief, stage, st, age, recent, delivered, done)
  loop
    insert into public.contacts
      (workspace_id, is_demo, first_name, last_name, email, phone_country_code, phone_number,
       country, source_id, status_id, is_client, converted_at, last_contact_at, created_at)
    values
      (p_ws, true, v.fn, v.ln, v.email, v.cc, v.phone, v.country,
       case v.src when 'ig' then src_ig when 'wa' then src_wa when 'web' then src_web when 'ref' then src_ref else src_walk end,
       st_won, true,
       now() - make_interval(days => v.age - 3),
       now() - make_interval(days => least(v.recent, 14)),
       now() - make_interval(days => v.age))
    returning id into cid;

    pid := public.create_project_in(p_ws, cid, v.pname, v.addr, v.area, v.ptype, v.brief);

    insert into sc (k, cid, pid, value, stage_no, age, recent, delivered)
    select v.k, cid, pid, v.area * rate, d.sort_order, v.age, v.recent, v.delivered
      from public.stage_definitions d where d.stage_key = v.stage;

    -- Walk the project to its stage. The closed stages are spread
    -- evenly between first contact and the most recent close, so a
    -- project that has been running for a year looks like it.
    update public.project_stages ps
       set status = 'complete',
           completed_at = now() - make_interval(days =>
             round(s.age - (s.age - s.recent) * ps.sort_order::numeric / greatest(s.stage_no - 1, 1))::int)
      from sc s
     where s.k = v.k and ps.project_id = s.pid and ps.sort_order < s.stage_no;

    update public.project_stages ps
       set status = 'active'
      from sc s
     where s.k = v.k and ps.project_id = s.pid and ps.sort_order = s.stage_no;

    -- Part of the open stage's checklist is done.
    with open_items as (
      select ci.id from public.checklist_items ci
       where ci.project_id = pid and ci.stage_key = v.stage
       order by ci.sort_order limit v.done
    )
    update public.checklist_items ci
       set is_done = true, done_at = now() - make_interval(days => greatest(v.recent - 1, 0)), done_by = owner_id
      from open_items o where ci.id = o.id;

    update public.projects
       set is_demo = true,
           current_stage = v.stage,
           state = v.st::public.project_state,
           is_archived = (v.stage in ('09_delivered','10_followup')),
           delivered_at = case when v.delivered is null then null
                               else now() - make_interval(days => v.delivered) end,
           value = case v.stage when '01_consultation' then null else v.area * rate end,
           started_at = now() - make_interval(days => v.age),
           created_at = now() - make_interval(days => v.age)
     where id = pid;

    made := made + 1;
  end loop;
  perform public.demo_expect('showcase projects', 20, made);

  -- ---------------------------------------------------------------
  -- 2. A dozen leads that did not become projects — a real year
  -- ---------------------------------------------------------------
  insert into public.contacts
    (workspace_id, is_demo, first_name, last_name, email, phone_country_code, phone_number,
     country, source_id, status_id, is_client, last_contact_at, created_at)
  select p_ws, true, x.fn, x.ln, x.email, x.cc, x.phone, x.country,
         case x.src when 'ig' then src_ig when 'wa' then src_wa when 'web' then src_web when 'ref' then src_ref else src_walk end,
         case x.st when 'new' then st_new when 'contacted' then st_contacted when 'f1' then st_f1
                   when 'f2' then st_f2 when 'rejected' then st_rejected else st_lost end,
         false, now() - make_interval(days => x.last), now() - make_interval(days => x.age)
  from (values
    ('أميرة','لطفي','amira.l@example.com','+20','1055503001','EG','ig','new',1,1),
    ('باسم','الغامدي','basem.g@example.com','+966','555553002','SA','web','contacted',4,2),
    ('هند','عادل','hend.a@example.com','+20','1155503003','EG','ig','f1',8,3),
    ('عبد الرحمن','الزهراني','abdulrahman.z@example.com','+966','505553004','SA','ref','f2',15,5),
    ('نيرة','سامي','nayera.s@example.com','+20','1255503005','EG','wa','lost',27,20),
    ('فيصل','الدوسري','faisal.d@example.com','+966','555553006','SA','ig','rejected',45,38),
    ('مي','حسام','mai.h@example.com','+20','1055503007','EG','web','contacted',60,55),
    ('سلطان','المهيري','sultan.m@example.com','+971','505553008','AE','ref','lost',90,80),
    ('رضوى','مجدي','radwa.m@example.com','+20','1155503009','EG','ig','lost',130,120),
    ('عائشة','الجابر','aisha.j@example.com','+974','555553010','QA','wa','rejected',200,190),
    ('شريف','عاطف','sherif.a@example.com','+20','1255503011','EG','walk','lost',260,250),
    ('جواهر','الفهد','jawaher.f@example.com','+966','505553012','SA','ig','rejected',320,310)
  ) as x(fn, ln, email, cc, phone, country, src, st, age, last);
  get diagnostics n = row_count;
  perform public.demo_expect('showcase leads', 12, n);

  -- ---------------------------------------------------------------
  -- 3. Invoices — four payments over a project's life, and the ones
  --    that are late are late on purpose.
  -- ---------------------------------------------------------------
  insert into public.invoices (workspace_id, project_id, contact_id, amount, currency, status, issued_at)
  select p_ws, s.pid, s.cid, round(s.value * x.share), 'EGP', x.status::public.invoice_status,
         case x.at
           when 'now'       then now() - make_interval(days => x.days)
           when 'delivered' then now() - make_interval(days => s.delivered)
           else (select ps.completed_at from public.project_stages ps
                  where ps.project_id = s.pid and ps.stage_key = x.at)
         end
  from (values
    -- first payment, 30 %, when the contract stage closed
    ('D',0.30,'sent','now',32),
    ('F',0.30,'paid','03_contract',0),('G',0.30,'paid','03_contract',0),('H',0.30,'paid','03_contract',0),
    ('I',0.30,'paid','03_contract',0),('J',0.30,'paid','03_contract',0),('K',0.30,'paid','03_contract',0),
    ('L',0.30,'paid','03_contract',0),('M',0.30,'paid','03_contract',0),('N',0.30,'paid','03_contract',0),
    ('O',0.30,'paid','03_contract',0),('P',0.30,'paid','03_contract',0),('Q',0.30,'paid','03_contract',0),
    ('R',0.30,'paid','03_contract',0),('S',0.30,'paid','03_contract',0),('T',0.30,'paid','03_contract',0),
    -- second payment, 30 %, when the concept was approved
    ('J',0.30,'paid','05_concept',0),('K',0.30,'sent','05_concept',0),('L',0.30,'paid','05_concept',0),
    ('M',0.30,'paid','05_concept',0),('N',0.30,'paid','05_concept',0),('O',0.30,'paid','05_concept',0),
    ('P',0.30,'paid','05_concept',0),('Q',0.30,'paid','05_concept',0),('R',0.30,'paid','05_concept',0),
    ('S',0.30,'paid','05_concept',0),('T',0.30,'paid','05_concept',0),
    -- third payment, 25 %, at the start of construction
    ('N',0.25,'paid','07_tender_ffe',0),('O',0.25,'paid','07_tender_ffe',0),('P',0.25,'sent','07_tender_ffe',0),
    ('Q',0.25,'paid','07_tender_ffe',0),('R',0.25,'paid','07_tender_ffe',0),('S',0.25,'paid','07_tender_ffe',0),
    ('T',0.25,'paid','07_tender_ffe',0),
    -- final payment, 15 %, on delivery
    ('Q',0.15,'paid','delivered',0),('R',0.15,'sent','delivered',0),('S',0.15,'paid','delivered',0),('T',0.15,'paid','delivered',0)
  ) as x(k, share, status, at, days)
  join sc s on s.k = x.k;
  get diagnostics n = row_count;
  perform public.demo_expect('showcase invoices', 38, n);

  -- ---------------------------------------------------------------
  -- 4. Tasks — six overdue, two today, six ahead
  -- ---------------------------------------------------------------
  insert into public.tasks (workspace_id, title, contact_id, project_id, stage_key, due_date, source, created_by)
  select p_ws, x.title, s.cid, s.pid, ps.stage_key, current_date + x.due, x.src::public.task_source, owner_id
  from (values
    ('D','متابعة الدفعة الأولى — العقد موقّع من 32 يوم',-20,'stage_rule'),
    ('C','متابعة عرض الأتعاب — من غير رد من 3 أسابيع',-10,'followup'),
    ('K','متابعة الدفعة التانية المتأخرة',-12,'stage_rule'),
    ('K','تعديل توزيع الاستقبال حسب طلب العميلة',-3,'portal'),
    ('P','الدفعة التالتة متأخرة — المقاول واقف',-8,'stage_rule'),
    ('R','الفاتورة النهائية لسه ما اتدفعتش',-30,'stage_rule'),
    ('G','متابعة استبيان الاستقبال',-2,'followup'),
    ('H','تجهيز عرض الكونسبت',0,'manual'),
    ('J','إرسال رسومات الإضاءة للاعتماد',0,'manual'),
    ('B','متابعة عرض الأتعاب',1,'followup'),
    ('N','زيارة موقع — مراجعة الجبس والإضاءة',2,'manual'),
    ('A','تحضير ورقة الاستشارة',2,'stage_rule'),
    ('M','العميلة تختار بين عرضين النجارة',3,'followup'),
    ('Q','تصوير المشروع بعد التسليم',5,'stage_rule')
  ) as x(k, title, due, src)
  join sc s on s.k = x.k
  join public.project_stages ps on ps.project_id = s.pid and ps.status = 'active';
  get diagnostics n = row_count;
  perform public.demo_expect('showcase tasks', 14, n);

  -- ---------------------------------------------------------------
  -- 5. Notes — two per client, in the designer's own voice
  -- ---------------------------------------------------------------
  insert into public.notes (workspace_id, contact_id, body, created_by, created_at)
  select p_ws, s.cid, x.body, owner_id, now() - make_interval(days => x.ago)
  from (values
    ('A','وصلت من إنستجرام. الشقة في جاردن سيتي وعايزة تحافظ على الأسقف والكرانيش.',4),
    ('A','حجزت الاستشارة. طلبت مني أجيب صور شغل كلاسيك.',2),
    ('B','زيارة الموقع في أبوظبي. الفيلا على العظم والمخططات معانا.',15),
    ('B','بعتّ عرض الأتعاب. قال هيراجعه مع زوجته ويرد الأسبوع الجاي.',9),
    ('C','مكالمة أولى. الميزانية ضيقة، اقترحت مرحلتين.',36),
    ('C','بعتّ العرض من 3 أسابيع. اتصلت مرتين ومفيش رد. آخر محاولة الأسبوع ده.',24),
    ('D','زيارة الموقع بالرياض. مشروع كبير، 3 أدوار. عايز الفخامة تبان من الباب.',48),
    ('D','وقّع العقد وبعت صورته. قال المحاسب هيحوّل خلال أسبوع — ده كان من شهر.',32),
    ('E','مكالمة. الأمان للأطفال أهم حاجة. مفيش زجاج منخفض ولا حواف حادة.',26),
    ('E','بعتّ العقد للتوقيع. قالت هتقراه مع جوزها.',6),
    ('F','الدفعة الأولى وصلت في يومين. عميل منظم.',6),
    ('F','بعتّ حقيبة الترحيب. رد على الاستبيان في نفس اليوم.',4),
    ('G','وقّعت ودفعت. طلبت نبدأ بعد رجوعها من السفر.',20),
    ('G','بعتّ الاستبيان مرتين. مشغولة، قالت هتملاه في الويكند.',12),
    ('H','الإطلالة هي المشروع. كل الفرش هيتوجّه للبحر.',30),
    ('H','بدأت الكونسبت. لوحة الخامات: أبيض، رمادي دافي، خشب بلوط.',8),
    ('I','الهوية وردي ونحاسي. العميلة عندها مرجع صالون في لندن عاجبها.',30),
    ('I','نشرت الكونسبت على البوابة وبعتّ اللينك. لسه ما اعتمدتش.',8),
    ('J','اعتمد الكونسبت من أول مرة. عميل واضح وبيقرر بسرعة.',40),
    ('J','رسومات الإضاءة خلصت. هبعتها للاعتماد النهاردة.',1),
    ('K','اعتمدت الكونسبت بعد تعديلين. حسّاسة للتفاصيل.',60),
    ('K','طلبت تعديل تالت من البوابة والدفعة التانية لسه ما وصلتش. لازم نتكلم عن الاتنين مع بعض.',5),
    ('L','مزرعة في الوفرة. الجلسات الخارجية أهم من الداخل.',50),
    ('L','جمعت 3 عروض نجارة و2 رخام. الفرق بين الأعلى والأقل 22٪.',10),
    ('M','اعتمدت تطوير التصميم كامل. بدأنا المناقصة.',30),
    ('M','مترددة بين عرضين نجارة. بعتّ لها مقارنة بالصور.',15),
    ('N','بدأ التنفيذ. المقاول من ترشيحنا وشغال كويس.',90),
    ('N','زيارة موقع. الجبس خلص والدهان بدأ في المجلس.',5),
    ('O','التنفيذ كان ماشي كويس لحد ما سافرت.',60),
    ('O','طلبت نوقف 3 شهور. قفلنا الموقع وخزّنا الخامات.',35),
    ('P','لازم يفتح قبل الصيف. الجدول ضيق.',80),
    ('P','المقاول واقف بسبب الدفعة التالتة. كلمته مرتين وقال الأسبوع الجاي.',6),
    ('Q','التسليم النهائي. العميلة عزمت الأهل في نفس اليوم.',20),
    ('Q','الفاتورة النهائية اتدفعت. هنصوّر المشروع الأسبوع الجاي.',12),
    ('R','التسليم تم. في ملاحظات بسيطة على باب الحمام اتصلّحت.',45),
    ('R','الفاتورة النهائية لسه ما اتدفعتش. بعتّ تذكير مرتين.',10),
    ('S','اتسلمت من 5 شهور. كل حاجة تمام.',150),
    ('S','متابعة الـ 6 شهور قرّبت. هسألها عن الستائر اللي كانت ناوية تغيرها.',20),
    ('T','عميل من أحسن اللي اشتغلنا معاهم. رشّح لينا عميلين.',300),
    ('T','متابعة السنة الشهر الجاي. ممكن يكون عنده مشروع تاني للمكتب.',30)
  ) as x(k, body, ago)
  join sc s on s.k = x.k;
  get diagnostics n = row_count;
  perform public.demo_expect('showcase notes', 40, n);

  -- ---------------------------------------------------------------
  -- 6. Time on the design and site work
  -- ---------------------------------------------------------------
  insert into public.time_logs (workspace_id, project_id, stage_key, minutes, note, logged_at, logged_by)
  select p_ws, s.pid, x.stage, x.minutes, x.note, now() - make_interval(days => x.ago), owner_id
  from (values
    ('H','05_concept',240,'لوحة الخامات والمراجع',7),
    ('H','05_concept',180,'مخطط توزيع الفرش',4),
    ('H','05_concept',120,'تعديل التراس',1),
    ('J','06_design_development',300,'رسومات الإضاءة',9),
    ('J','06_design_development',240,'تفاصيل المطبخ',5),
    ('J','06_design_development',150,'مراجعة نهائية',2),
    ('L','07_tender_ffe',120,'مقارنة عروض النجارة',8),
    ('L','07_tender_ffe',90,'زيارة معرض الرخام',3),
    ('N','08_construction',180,'زيارة موقع — الجبس',19),
    ('N','08_construction',150,'زيارة موقع — الكهرباء',12),
    ('N','08_construction',180,'زيارة موقع — الدهانات',5),
    ('N','08_construction',60,'اجتماع مع المقاول',2)
  ) as x(k, stage, minutes, note, ago)
  join sc s on s.k = x.k;
  get diagnostics n = row_count;
  perform public.demo_expect('showcase time logs', 12, n);

  -- ---------------------------------------------------------------
  -- 7. An occasion. (The 6-month and 1-year follow-ups are not
  --    written here: delivering a project creates them by rule, so
  --    the two delivered-months-ago projects already carry theirs.)
  -- ---------------------------------------------------------------
  insert into public.reminders (workspace_id, contact_id, project_id, kind, due_date, recurring, year)
  select p_ws, s.cid, s.pid, x.kind::public.reminder_kind, current_date + x.due, x.recurring,
         case when x.recurring then extract(year from current_date)::int else null end
  from (values
    ('N','birthday',6,true)
  ) as x(k, kind, due, recurring)
  join sc s on s.k = x.k;
  get diagnostics n = row_count;
  perform public.demo_expect('showcase reminders', 1, n);

  update public.contacts c set birthday = (current_date + 6 - interval '41 years')::date
    from sc s where c.id = s.cid and s.k = 'N';

  -- ---------------------------------------------------------------
  -- 8. Consultations — the booked one ahead, and the ones that
  --    started each project. Slots must not overlap anything already
  --    in the diary, so a clash is skipped rather than fatal.
  -- ---------------------------------------------------------------
  insert into public.bookings
    (workspace_id, session_type_id, slot_start, slot_end, status, client_name, client_email,
     contact_id, project_id, seen_at, created_at)
  select p_ws, session_id,
         date_trunc('day', now()) - make_interval(days => x.ago) + make_interval(hours => x.hour),
         date_trunc('day', now()) - make_interval(days => x.ago) + make_interval(hours => x.hour, mins => 60),
         x.status::public.booking_status,
         c.first_name || ' ' || c.last_name, c.email, s.cid, s.pid,
         now() - make_interval(days => x.ago + 1), now() - make_interval(days => x.ago + 2)
  from (values
    ('A',-2,12,'confirmed'),
    ('B',18,11,'completed'),('D',49,13,'completed'),('F',37,11,'completed'),
    ('H',67,15,'completed'),('J',92,11,'completed'),('L',127,13,'completed'),
    ('N',197,11,'completed'),('Q',257,15,'completed')
  ) as x(k, ago, hour, status)
  join sc s on s.k = x.k
  join public.contacts c on c.id = s.cid
  on conflict do nothing;

  return jsonb_build_object(
    'projects', made,
    'invoices', (select count(*) from public.invoices i join sc s on s.pid = i.project_id),
    'bookings', (select count(*) from public.bookings b join sc s on s.pid = b.project_id),
    'revenue_12m', (select sum(amount) from public.invoices
                     where workspace_id = p_ws and is_demo and status <> 'draft'
                       and issued_at > now() - interval '12 months'));
end;
$$;

revoke all on function public.showcase_seed(uuid) from public, anon, authenticated;
