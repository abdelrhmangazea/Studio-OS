-- =============================================================
-- 0042 — the demo data seeder.
--
-- Teaching material for the Academy. Every record here exists to
-- demonstrate one specific part of the product, so a class can be
-- run end to end without anybody inventing data on the spot.
--
-- Two rules govern this whole file:
--
--   1. Loading demo data must NEVER touch a real record. Everything
--      written carries is_demo, everything deleted is filtered on it.
--
--   2. Every write with a fixed, known row count asserts that count
--      and fails loudly when it does not match. This is not defensive
--      padding — an earlier version of the revisions upsert matched
--      zero rows and returned success, so the revision counter showed
--      nothing and the seeder reported a clean run. An exit code is
--      not evidence. The count is.
--
-- All names, companies and phone numbers are invented. The local
-- parts (555…/505…/105…) are not allocatable ranges.
-- =============================================================

/* ------------------------------------------------------------------
   1. is_demo has to reach the documents and the invoices.

   Neither table had it, because neither is seeded directly — they
   hang off a contact or a project. But the badge is needed on both,
   and deriving it at read time would miss the case that matters most
   in a classroom: a student generating a contract for a demo client.
   That document IS demo data, and it is created by the student, not
   by the seeder.

   So the flag is a real column, set from the parent on insert.
------------------------------------------------------------------ */

alter table public.invoices
  add column if not exists is_demo boolean not null default false;
alter table public.generated_documents
  add column if not exists is_demo boolean not null default false;

create or replace function public.demo_flag_from_parent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  -- An explicit true is honoured; otherwise inherit. Either parent
  -- being demo is enough — a row can name a project, a contact, or
  -- both, and any of them being teaching data makes this one too.
  if new.is_demo then return new; end if;

  new.is_demo :=
       coalesce((select p.is_demo from public.projects p where p.id = new.project_id), false)
    or coalesce((select c.is_demo from public.contacts c where c.id = new.contact_id), false);

  return new;
end;
$$;

drop trigger if exists demo_flag on public.invoices;
create trigger demo_flag before insert on public.invoices
  for each row execute function public.demo_flag_from_parent();

drop trigger if exists demo_flag on public.generated_documents;
create trigger demo_flag before insert on public.generated_documents
  for each row execute function public.demo_flag_from_parent();

-- Anything already sitting under a demo parent.
update public.invoices i set is_demo = true
 where not i.is_demo
   and (exists (select 1 from public.projects p where p.id = i.project_id and p.is_demo)
     or exists (select 1 from public.contacts c where c.id = i.contact_id and c.is_demo));

update public.generated_documents g set is_demo = true
 where not g.is_demo
   and (exists (select 1 from public.projects p where p.id = g.project_id and p.is_demo)
     or exists (select 1 from public.contacts c where c.id = g.contact_id and c.is_demo));

/* ------------------------------------------------------------------
   2. The assertion.

   Called after every fixed-count write in this file. It raises, which
   aborts the whole load — a half-seeded workspace is worse teaching
   material than an empty one, because the gaps look like features.
------------------------------------------------------------------ */

create or replace function public.demo_expect(p_what text, p_expected int, p_actual int)
returns void
language plpgsql
immutable
set search_path to ''
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'demo seeder: % wrote % row(s), expected %', p_what, p_actual, p_expected;
  end if;
end;
$$;

revoke all on function public.demo_expect(text, int, int) from public, anon, authenticated;

/* ------------------------------------------------------------------
   3. The people. 8 leads — one per pipeline status — and 11 clients.
------------------------------------------------------------------ */

create or replace function public.demo_seed_people(p_ws uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  st jsonb := '{}'::jsonb;
  sr jsonb := '{}'::jsonb;
  r record;
  n int;
begin
  for r in select label_en, id from public.lead_statuses where workspace_id = p_ws loop
    st := st || jsonb_build_object(r.label_en, r.id);
  end loop;
  for r in select label_en, id from public.lead_sources where workspace_id = p_ws loop
    sr := sr || jsonb_build_object(r.label_en, r.id);
  end loop;

  -- The ages are the point: two green, two orange, one red, so the
  -- lead list demonstrates its own colour rules without editing.
  insert into public.contacts
    (workspace_id, is_demo, first_name, last_name, email, phone_country_code, phone_number,
     status_id, source_id, country, next_action_at, last_contact_at, created_at)
  select p_ws, true, v.fn, v.ln, v.em, v.cc, v.pn,
         (st->>v.status)::uuid, (sr->>v.src)::uuid, v.cty,
         case when v.next_in is null then null else now() + v.next_in end,
         now() - v.last, now() - v.age
  from (values
    ('ندى','الشامي','nada.demo@example.com','+20','1055500011','New','Instagram','EG',
       interval '1 day',  interval '1 day',  interval '1 day'),
    ('كريم','العطار','karim.demo@example.com','+20','1055500022','Contacted','WhatsApp','EG',
       interval '2 days', interval '3 days', interval '9 days'),
    ('هند','المطيري','hind.demo@example.com','+966','505550033','Follow-up 1','Referral','SA',
       interval '4 days', interval '6 days', interval '20 days'),
    ('سلطان','الحمادي','sultan.demo@example.com','+971','505550044','Follow-up 2','Website','AE',
       interval '1 day',  interval '12 days', interval '35 days'),
    ('مريم','عبد الرحمن','mariam.demo@example.com','+20','1155500055','Follow-up 3','Instagram','EG',
       null,              interval '26 days', interval '60 days'),
    ('ياسر','القحطاني','yasser.demo@example.com','+966','555550066','Rejected','Referral','SA',
       null,              interval '40 days', interval '55 days'),
    ('ليلى','بن سعيد','laila.demo@example.com','+971','555550077','Not interested','Walk-in','AE',
       null,              interval '48 days', interval '70 days'),
    ('رانيا','فؤاد','rania.demo@example.com','+20','1255500088','Booked','Instagram','EG',
       interval '5 days', interval '2 days', interval '14 days')
  ) as v(fn, ln, em, cc, pn, status, src, cty, next_in, last, age);

  get diagnostics n = row_count;
  perform public.demo_expect('leads', 8, n);

  insert into public.contacts
    (workspace_id, is_demo, first_name, last_name, email, phone_country_code, phone_number,
     status_id, source_id, country, is_client, converted_at, last_contact_at, created_at)
  select p_ws, true, v.fn, v.ln, v.em, v.cc, v.pn,
         (st->>'Booked')::uuid, (sr->>v.src)::uuid, v.cty, true,
         now() - v.age, now() - v.last, now() - v.age
  from (values
    ('دينا','مرسي','dina.demo@example.com','+20','1055501001','Instagram','EG', interval '10 days',  interval '2 days'),
    ('فهد','العتيبي','fahd.demo@example.com','+966','505551002','Referral','SA', interval '25 days',  interval '3 days'),
    ('عمر','الزرعوني','omar.demo@example.com','+971','505551003','Website','AE', interval '40 days',  interval '5 days'),
    ('سارة','الجندي','sara.demo@example.com','+20','1155501004','Instagram','EG', interval '55 days',  interval '4 days'),
    ('نورة','باعشن','noura.demo@example.com','+966','555551005','Instagram','SA', interval '70 days',  interval '6 days'),
    ('طارق','شلبي','tarek.demo@example.com','+20','1055501006','Referral','EG', interval '85 days',  interval '7 days'),
    ('بدر','الصباح','badr.demo@example.com','+971','505551007','Website','AE', interval '100 days', interval '9 days'),
    ('هالة','نصّار','hala.demo@example.com','+971','555551008','WhatsApp','AE', interval '120 days', interval '11 days'),
    ('يوسف','الديب','youssef.demo@example.com','+20','1255501009','Referral','EG', interval '150 days', interval '8 days'),
    ('منى','الحديدي','mona.demo@example.com','+20','1055501010','Instagram','EG', interval '300 days', interval '30 days'),
    ('أحمد','رشدي','ahmed.demo@example.com','+20','1155501011','WhatsApp','EG', interval '45 days',  interval '21 days')
  ) as v(fn, ln, em, cc, pn, src, cty, age, last);

  get diagnostics n = row_count;
  perform public.demo_expect('clients', 11, n);
end;
$$;

/* ------------------------------------------------------------------
   4. The projects. One per stage, so every stage in the pipeline has
      something to open during a class, plus one on hold.

      These go through create_project_in() rather than a raw insert:
      that is what allocates the never-reused project code, builds the
      ten stage rows and lays down the checklist. Seeding around that
      machinery would teach students a project that does not behave
      like one they made themselves.
------------------------------------------------------------------ */

create or replace function public.demo_seed_projects(p_ws uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v record;
  cid uuid;
  pid uuid;
  stage_no int;
  made int := 0;
begin
  for v in
    select * from (values
      ('دينا','مرسي','شقة التجمع الخامس','التجمع الخامس، القاهرة الجديدة',180,'شقة سكنية',
       '181 م² دور سابع، فاضية بالكامل. العميلة عايزة ريسبشن مفتوح على المطبخ، وأوضة مكتب تتحول لأوضة ضيوف. بتحب الألوان الدافية والخشب الطبيعي، وما بتحبش الرخام الأبيض اللامع. الميزانية مرنة بس عايزة تعرف الرقم قبل ما تبدأ.',
       '01_consultation','on_track'),

      ('فهد','العتيبي','فيلا حي الياسمين','حي الياسمين، الرياض',620,'فيلا',
       'فيلا دورين وملحق، 620 م². التسليم على العظم. العميل عايز مجلس رجال منفصل بمدخل خاص، وصالة عائلية واسعة. طلب تحديداً إن الإضاءة تكون مخفية بالكامل. عنده تحفظ على أي حاجة تبان مودرن أوي.',
       '02_fee_proposal','waiting_client'),

      ('عمر','الزرعوني','مكتب الخليج التجاري','الخليج التجاري، دبي',340,'مكتب',
       'مكتب 340 م² في برج، 12 موظف. مطلوب 3 غرف اجتماعات وركن استقبال. الشركة عندها هوية بصرية جاهزة لازم الديكور يمشي عليها. التنفيذ لازم يخلص قبل نهاية عقد الإيجار الحالي.',
       '03_contract','needs_attention'),

      ('سارة','الجندي','شقة الشيخ زايد','الشيخ زايد، الجيزة',210,'شقة سكنية',
       'شقة 210 م² دور أرضي بحديقة صغيرة. أسرة بطفلين. الأولوية للتخزين — العميلة بتقول إن ده أكتر حاجة ناقصاها في بيتها الحالي. عايزة الحديقة تبقى امتداد للصالة مش مساحة منفصلة.',
       '04_onboarding','waiting_client'),

      ('نورة','باعشن','كافيه الروشان','حي الروشان، جدة',150,'كافيه',
       'كافيه 150 م² دورين، سعة 45 كرسي. المفهوم قهوة مختصة. العميلة عايزة الفرش يبان في الصور — المكان هيتصور كتير على إنستجرام. لازم يكون في ركن هادي للشغل ومنطقة أعلى صوت.',
       '05_concept','waiting_client'),

      ('طارق','شلبي','عيادة أسنان المعادي','المعادي، القاهرة',120,'عيادة',
       'عيادة أسنان 120 م²، كرسيين وغرفة تعقيم واستقبال. في اشتراطات صحية لازم تتراعى في اختيار الخامات والأرضيات. الدكتور عايز المكان يحس المريض بالهدوء مش بالمستشفى.',
       '06_design_development','on_track'),

      ('بدر','الصباح','دوبلكس السالمية','السالمية، مدينة الكويت',400,'دوبلكس',
       'دوبلكس 400 م² بسلم داخلي. الدور الأرضي استقبال وضيافة، والعلوي خاص. العميل عنده مجموعة سجاد وتحف عايز التصميم يتبني حواليها مش العكس.',
       '07_tender_ffe','on_track'),

      ('هالة','نصّار','مطعم الشارقة','منطقة القصباء، الشارقة',280,'مطعم',
       'مطعم 280 م² سعة 80 كرسي، مطبخ مفتوح جزئياً. التنفيذ شغال حالياً. في تعديل على توزيع الإضاءة اتفق عليه في الموقع الأسبوع اللي فات.',
       '08_construction','on_track'),

      ('يوسف','الديب','فيلا الساحل الشمالي','سيدي عبد الرحمن، الساحل الشمالي',500,'فيلا',
       'فيلا مصيف 500 م² بمسبح. تسليم صيفي. الطابع بحري هادي — أبيض وكتان وخشب مغسول. اتسلمت الأسبوع اللي فات والعميل مبسوط.',
       '09_delivered','on_track'),

      ('منى','الحديدي','شقة مدينة نصر','مدينة نصر، القاهرة',165,'شقة سكنية',
       'شقة 165 م² لأسرة صغيرة. اتسلمت من 8 شهور. العميلة رجعت تسأل عن تجديد الأنتريه وممكن مشروع تاني لشقة بنتها.',
       '10_followup','on_track'),

      ('أحمد','رشدي','شقة الدقي','الدقي، الجيزة',140,'شقة سكنية',
       'شقة 140 م². العميل مسافر برة مصر لمدة شهرين وطلب نوقف الشغل لحد ما يرجع. كل الملفات محفوظة والمشروع متوقف مش ملغي.',
       '01_consultation','on_hold')
    ) as x(fn, ln, pname, addr, area, ptype, brief, stage, st)
  loop
    select c.id into cid from public.contacts c
     where c.workspace_id = p_ws and c.is_demo
       and c.first_name = v.fn and c.last_name = v.ln
     limit 1;

    -- Not "continue". A missing client means the people seeder and
    -- this list have drifted apart, and skipping it quietly is how
    -- you end up with a stage nobody can demonstrate.
    if cid is null then
      raise exception 'demo seeder: no demo client % % for project %', v.fn, v.ln, v.pname;
    end if;

    pid := public.create_project_in(p_ws, cid, v.pname, v.addr, v.area, v.ptype, v.brief);

    select d.sort_order into stage_no
      from public.stage_definitions d where d.stage_key = v.stage;

    -- Walk the project to its stage: everything before it is complete.
    update public.project_stages ps
       set status = 'complete',
           completed_at = now() - make_interval(days => (stage_no - ps.sort_order) * 3)
      from public.stage_definitions d
     where ps.project_id = pid and d.stage_key = ps.stage_key and d.sort_order < stage_no;

    update public.project_stages ps
       set status = 'active'
      from public.stage_definitions d
     where ps.project_id = pid and d.stage_key = ps.stage_key and d.sort_order = stage_no;

    update public.projects
       set is_demo = true,
           current_stage = v.stage,
           state = v.st::public.project_state,
           is_archived = (v.stage in ('09_delivered','10_followup')),
           delivered_at = case v.stage
             when '09_delivered' then now() - interval '6 days'
             when '10_followup'  then now() - interval '240 days'
             else null end,
           value = case v.stage when '01_consultation' then null else v.area * 1200 end
     where id = pid;

    made := made + 1;
  end loop;

  perform public.demo_expect('projects', 11, made);
  perform public.demo_expect('stages covered', 10,
    (select count(distinct current_stage)::int from public.projects
      where workspace_id = p_ws and is_demo));
end;
$$;

/* ------------------------------------------------------------------
   5. Everything hanging off the projects.
------------------------------------------------------------------ */

create or replace function public.demo_seed_supporting(p_ws uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  p_consult uuid; p_fee uuid; p_contract uuid; p_onboard uuid; p_concept uuid;
  p_dd uuid; p_tender uuid; p_construct uuid; p_deliv uuid; p_follow uuid;
  p_hold uuid;
  inv1 uuid; inv2 uuid; sup record; owner_id uuid; n int;
begin
  select p.id into owner_id from public.profiles p
   where p.workspace_id = p_ws and p.role = 'owner' limit 1;

  select id into p_consult   from public.projects where workspace_id=p_ws and is_demo and current_stage='01_consultation' and state<>'on_hold' limit 1;
  select id into p_hold      from public.projects where workspace_id=p_ws and is_demo and state='on_hold' limit 1;
  select id into p_fee       from public.projects where workspace_id=p_ws and is_demo and current_stage='02_fee_proposal' limit 1;
  select id into p_contract  from public.projects where workspace_id=p_ws and is_demo and current_stage='03_contract' limit 1;
  select id into p_onboard   from public.projects where workspace_id=p_ws and is_demo and current_stage='04_onboarding' limit 1;
  select id into p_concept   from public.projects where workspace_id=p_ws and is_demo and current_stage='05_concept' limit 1;
  select id into p_dd        from public.projects where workspace_id=p_ws and is_demo and current_stage='06_design_development' limit 1;
  select id into p_tender    from public.projects where workspace_id=p_ws and is_demo and current_stage='07_tender_ffe' limit 1;
  select id into p_construct from public.projects where workspace_id=p_ws and is_demo and current_stage='08_construction' limit 1;
  select id into p_deliv     from public.projects where workspace_id=p_ws and is_demo and current_stage='09_delivered' limit 1;
  select id into p_follow    from public.projects where workspace_id=p_ws and is_demo and current_stage='10_followup' limit 1;

  insert into public.suppliers (workspace_id, is_demo, name, category, phone_country_code, phone_number, email, rating, active, notes)
  values
    (p_ws,true,'نجارة الحرفي','نجارة','+20','1055502001','joinery.demo@example.com',5,true,'شغل نضيف ومواعيد مظبوطة. أغلى شوية بس ما بيتأخرش.'),
    (p_ws,true,'إضاءة النور','إضاءة','+20','1055502002','lighting.demo@example.com',4,true,'تشكيلة كويسة. لازم تتأكد من درجة اللون قبل التوريد.'),
    (p_ws,true,'أرضيات الصفوة','أرضيات','+966','505552003','flooring.demo@example.com',4,true,'باركيه وسيراميك. عندهم كتالوج محدث.'),
    (p_ws,true,'أثاث المعمار','أثاث','+971','505552004','furniture.demo@example.com',3,true,'تنفيذ حسب الطلب. المدة بتطول في المواسم.'),
    (p_ws,true,'ستائر الديار','ستائر','+20','1155502005','curtains.demo@example.com',5,true,'أسرع واحد في التركيب. بيقيس بنفسه.'),
    (p_ws,true,'رخام الشرق','رخام','+20','1255502006','marble.demo@example.com',4,true,'خامات كويسة. لازم تعاين البلوك قبل القص.');

  get diagnostics n = row_count;
  perform public.demo_expect('suppliers', 6, n);

  -- Notes go to the one project actually sitting at each stage. The
  -- on_hold project is excluded and gets its own note below: it is
  -- also at 01_consultation, and without the exclusion it inherited
  -- another client's notes — written about a different person, in the
  -- wrong gender. Demo data that reads wrong teaches wrong.
  insert into public.notes (workspace_id, contact_id, body, created_by, created_at)
  select p_ws, pr.contact_id, v.body, owner_id, now() - v.ago
  from public.projects pr
  join (values
    ('01_consultation','مكالمة أولى. قالت إنها شافت شغلنا على إنستجرام. الشقة فاضية والتسليم خلص من شهرين.', interval '9 days'),
    ('01_consultation','بعتّ لها لينك الحجز. حجزت استشارة الأسبوع الجاي.', interval '2 days'),
    ('02_fee_proposal','زيارة الموقع. الفيلا على العظم فعلاً. صورت كل الأدوار.', interval '12 days'),
    ('02_fee_proposal','بعتّ عرض الأتعاب. قال إنه هيراجعه مع أخوه ويرد.', interval '3 days'),
    ('03_contract','وقّع العقد وبعت صورة منه. المقدم لسه ما وصلش — قال بكرة تحويل.', interval '4 days'),
    ('03_contract','كلمته تاني. قال إن المحاسب مسافر ولسه هيحوّل.', interval '1 day'),
    ('04_onboarding','بعتّ باكيت الترحيب والاستبيان. لسه ما ردتش عليه.', interval '6 days'),
    ('05_concept','نشرت الكونسبت على البوابة وبعتّ لها اللينك.', interval '5 days'),
    ('06_design_development','عرضت عليه تطوير التصميم. وافق على التوزيع وطلب تعديل في الاستقبال.', interval '8 days'),
    ('07_tender_ffe','جمعت ٣ عروض للنجارة. فرق السعر بين الأعلى والأقل حوالي ٢٠٪.', interval '10 days'),
    ('08_construction','زيارة موقع. الجبس خلص والدهان بدأ في الصالة.', interval '3 days'),
    ('09_delivered','التسليم النهائي. صورنا المكان وهنستأذنه ننشر.', interval '6 days'),
    ('10_followup','كلمتها للمتابعة بعد ٦ شهور. كل حاجة تمام وسألت عن تجديد الأنتريه.', interval '60 days')
  ) as v(stage, body, ago) on v.stage = pr.current_stage
  where pr.workspace_id = p_ws and pr.is_demo and pr.state <> 'on_hold';

  get diagnostics n = row_count;
  perform public.demo_expect('notes', 13, n);

  insert into public.notes (workspace_id, contact_id, body, created_by, created_at)
  select p_ws, contact_id,
         'كلمني وقال إنه مسافر شهرين وعايز نوقف الشغل لحد ما يرجع. اتفقنا نسيب كل حاجة زي ما هي.',
         owner_id, now() - interval '21 days'
    from public.projects where id = p_hold;

  get diagnostics n = row_count;
  perform public.demo_expect('on-hold note', 1, n);

  -- 3 overdue, 2 today, 4 upcoming — mixed sources, so the task list
  -- shows where each one came from.
  insert into public.tasks (workspace_id, project_id, contact_id, title, due_date, source, created_by)
  select p_ws, v.pid, (select contact_id from public.projects where id = v.pid),
         v.title, v.due, v.src::public.task_source, owner_id
  from (values
    (p_contract,  'تتابع المقدم مع العميل — البوابة مش هتفتح من غيره', current_date - 3, 'stage_rule'),
    (p_onboard,   'تفكّر العميلة بالاستبيان',                          current_date - 2, 'stage_rule'),
    (p_fee,       'متابعة عرض الأتعاب بعد ٣ أيام',                     current_date - 1, 'stage_rule'),
    (p_concept,   'تراجع ملاحظات العميلة على الكونسبت',                current_date,     'manual'),
    (p_construct, 'زيارة موقع أسبوعية',                                current_date,     'manual'),
    (p_dd,        'تنفّذ التعديل المطلوب على الاستقبال',               current_date + 2, 'portal'),
    (p_tender,    'تبعت أمر التوريد للنجارة',                          current_date + 4, 'manual'),
    (p_deliv,     'تصوير احترافي للمشروع بعد التسليم',                 current_date + 7, 'stage_rule'),
    (p_follow,    'متابعة سنة من التسليم',                             current_date + 20,'followup')
  ) as v(pid, title, due, src);

  get diagnostics n = row_count;
  perform public.demo_expect('tasks', 9, n);

  -- One paid with a confirmed receipt, one sent awaiting confirmation,
  -- one sent with nothing against it.
  insert into public.invoices (workspace_id, project_id, contact_id, amount, currency, status, issued_at)
  values (p_ws, p_construct, (select contact_id from public.projects where id=p_construct),
          96000, 'EGP', 'paid', now() - interval '30 days')
  returning id into inv1;

  insert into public.invoices (workspace_id, project_id, contact_id, amount, currency, status, issued_at)
  values (p_ws, p_dd, (select contact_id from public.projects where id=p_dd),
          48000, 'EGP', 'sent', now() - interval '5 days')
  returning id into inv2;

  insert into public.invoices (workspace_id, project_id, contact_id, amount, currency, status, issued_at)
  values (p_ws, p_contract, (select contact_id from public.projects where id=p_contract),
          120000, 'EGP', 'sent', now() - interval '4 days');

  perform public.demo_expect('invoices', 3,
    (select count(*)::int from public.invoices where workspace_id = p_ws and is_demo));

  -- The receipts bucket keys its policy on the FIRST folder being the
  -- workspace id, so this path cannot follow the demo/ convention the
  -- project files use. Getting that wrong means a receipt that exists
  -- but will not open.
  insert into public.receipts (workspace_id, invoice_id, file_url, confirmed, confirmed_at, confirmed_by)
  values (p_ws, inv1, p_ws || '/demo-placeholder.jpg', true, now() - interval '29 days', owner_id);
  insert into public.receipts (workspace_id, invoice_id, file_url, confirmed)
  values (p_ws, inv2, p_ws || '/demo-placeholder.jpg', false);

  perform public.demo_expect('receipts', 2,
    (select count(*)::int from public.receipts r
      join public.invoices i on i.id = r.invoice_id
     where i.workspace_id = p_ws and i.is_demo));

  -- Three fee calculations, each a different method, so the pricing
  -- lesson can compare them side by side.
  insert into public.fee_calculations (workspace_id, project_id, method, inputs, result, created_by)
  values
    (p_ws, p_fee, 'per_sqm', '{"area":620,"rate":450,"complexity":"high"}'::jsonb,
     '{"base":279000,"recommended":334800,"currency":"SAR"}'::jsonb, owner_id),
    (p_ws, p_dd, 'percentage', '{"construction_cost":900000,"percentage":12}'::jsonb,
     '{"base":108000,"recommended":108000,"currency":"EGP"}'::jsonb, owner_id),
    (p_ws, p_tender, 'per_room', '{"rooms":9,"rate":11000}'::jsonb,
     '{"base":99000,"recommended":118800,"currency":"KWD"}'::jsonb, owner_id);

  get diagnostics n = row_count;
  perform public.demo_expect('fee calculations', 3, n);

  insert into public.portal_links (workspace_id, project_id, token, is_active)
  values (p_ws, p_concept, encode(extensions.gen_random_bytes(32),'hex'), true);

  get diagnostics n = row_count;
  perform public.demo_expect('portal link', 1, n);

  insert into public.approvals (workspace_id, project_id, stage_key, decision, comment, decided_at)
  values
    (p_ws, p_dd, '06_design_development', 'approved', 'التوزيع تمام، نكمل عليه.', now() - interval '9 days'),
    (p_ws, p_dd, '06_design_development', 'changes_requested',
     'ممكن نكبّر ركن الاستقبال شوية ونقلل الكراسي؟', now() - interval '8 days');

  get diagnostics n = row_count;
  perform public.demo_expect('approvals', 2, n);

  -- THE ONE THAT FAILED SILENTLY. It was an UPDATE against a row that
  -- did not exist yet: zero rows matched, no error, and the revision
  -- counter rendered blank while the seeder reported success. Upsert
  -- now, and assert the count, because the next silent one will only
  -- be caught if the seeder catches it.
  insert into public.revisions (workspace_id, project_id, free_allowance, used)
  values (p_ws, p_dd, 2, 1)
  on conflict (project_id) do update set used = 1, free_allowance = 2;

  get diagnostics n = row_count;
  perform public.demo_expect('revision counter', 1, n);

  for sup in select id, name, category from public.suppliers
              where workspace_id = p_ws and is_demo and category in ('نجارة','إضاءة','أثاث') loop
    insert into public.quotations (workspace_id, project_id, supplier_id, stage_key, title,
                                   amount, currency, status, requested_at, received_at)
    values (p_ws, p_tender, sup.id, '07_tender_ffe',
            'عرض سعر — ' || sup.name,
            case sup.category when 'نجارة' then 185000 when 'إضاءة' then 62000 else 210000 end,
            'KWD',
            case sup.category when 'نجارة' then 'accepted' else 'received' end,
            now() - interval '14 days', now() - interval '10 days');
  end loop;

  perform public.demo_expect('quotations', 3,
    (select count(*)::int from public.quotations where workspace_id = p_ws and project_id = p_tender));

  insert into public.time_logs (workspace_id, project_id, stage_key, minutes, note, logged_at, logged_by)
  values
    (p_ws, p_construct, '08_construction', 180, 'زيارة موقع ومتابعة الجبس', now() - interval '7 days', owner_id),
    (p_ws, p_construct, '08_construction', 120, 'اجتماع مع المقاول',        now() - interval '4 days', owner_id),
    (p_ws, p_construct, '08_construction', 240, 'مراجعة الرسومات التنفيذية', now() - interval '2 days', owner_id),
    (p_ws, p_dd,        '06_design_development', 300, 'تطوير التصميم',      now() - interval '6 days', owner_id);

  get diagnostics n = row_count;
  perform public.demo_expect('time logs', 4, n);

  -- Every row points at a real placeholder object, so a download in
  -- front of a class opens something instead of 404ing. The display
  -- names differ per row; two objects sit behind all seven.
  --
  -- The path is per workspace, NOT one shared object. Storage delete
  -- on this bucket is allowed to anyone holding a files row that names
  -- the object — so a single shared path would let one student delete
  -- the placeholder out from under every other studio.
  insert into public.files (workspace_id, project_id, stage_key, filename, file_url, is_published_to_portal, uploaded_at)
  select p_ws, v.pid, v.stage, v.fn,
         'demo/' || p_ws || case when v.fn like '%.jpg' then '/placeholder.jpg' else '/placeholder.pdf' end,
         v.pub, now() - v.ago
  from (values
    (p_concept,   '05_concept',            'الكونسبت-المبدئي.pdf',  true,  interval '5 days'),
    (p_concept,   '05_concept',            'لوحة-الخامات.jpg',      true,  interval '5 days'),
    (p_dd,        '06_design_development', 'المساقط-الأفقية.pdf',    true,  interval '9 days'),
    (p_dd,        '06_design_development', 'ملاحظات-داخلية.pdf',     false, interval '9 days'),
    (p_tender,    '07_tender_ffe',         'جدول-المفروشات.pdf',     false, interval '10 days'),
    (p_construct, '08_construction',       'الرسومات-التنفيذية.pdf', false, interval '15 days'),
    (p_deliv,     '09_delivered',          'صور-التسليم.jpg',        true,  interval '6 days')
  ) as v(pid, stage, fn, pub, ago);

  get diagnostics n = row_count;
  perform public.demo_expect('files', 7, n);
end;
$$;

/* ------------------------------------------------------------------
   6. Reset and load.
------------------------------------------------------------------ */

create or replace function public.reset_demo_data()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  ws uuid := public.current_workspace_id();
  gone_contacts int; gone_projects int; gone_suppliers int;
begin
  if ws is null then raise exception 'no workspace'; end if;
  if not (public.is_owner() or public.is_platform_admin()) then
    raise exception 'only the studio owner can reset demo data';
  end if;

  -- Approvals first, and deliberately.
  --
  -- Bucket 6 makes an approval permanent: it is the evidence behind a
  -- billable revision, so a trigger refuses to delete one. Correct for
  -- a real client, fatal here — project 06 must carry an approval to
  -- demonstrate the revision counter, which made the whole demo
  -- workspace un-resettable.
  --
  -- The trigger exempts demo projects. But in a CASCADE the parent row
  -- goes first, so by the time the cascade reaches the approval the
  -- project is already gone and the is_demo check reads nothing. They
  -- have to be deleted here, while the project still exists to prove
  -- they are teaching data.
  delete from public.approvals a
   using public.projects p
   where a.project_id = p.id and p.workspace_id = ws and p.is_demo;

  with x as (delete from public.projects where workspace_id = ws and is_demo returning 1)
  select count(*) into gone_projects from x;

  with x as (delete from public.contacts where workspace_id = ws and is_demo returning 1)
  select count(*) into gone_contacts from x;

  with x as (delete from public.suppliers where workspace_id = ws and is_demo returning 1)
  select count(*) into gone_suppliers from x;

  return jsonb_build_object('contacts', gone_contacts, 'projects', gone_projects,
                            'suppliers', gone_suppliers);
end;
$$;

create or replace function public.load_demo_data()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  ws uuid := public.current_workspace_id();
  real_before int;
  real_after int;
  result jsonb;
begin
  if ws is null then raise exception 'no workspace'; end if;
  if not (public.is_owner() or public.is_platform_admin()) then
    raise exception 'only the studio owner can load demo data';
  end if;

  -- The promise this function makes is that it never touches a real
  -- record. Count them before and after and refuse to return if the
  -- number moved. Cheap, and it turns the promise into a check.
  select count(*)::int into real_before
    from public.contacts where workspace_id = ws and not is_demo;

  perform public.reset_demo_data();

  perform public.demo_seed_people(ws);
  perform public.demo_seed_projects(ws);
  perform public.demo_seed_supporting(ws);

  select count(*)::int into real_after
    from public.contacts where workspace_id = ws and not is_demo;

  if real_after <> real_before then
    raise exception 'demo seeder touched real data: % real contacts before, % after',
      real_before, real_after;
  end if;

  select jsonb_build_object(
    'contacts',  (select count(*) from public.contacts  where workspace_id=ws and is_demo),
    'projects',  (select count(*) from public.projects  where workspace_id=ws and is_demo),
    'suppliers', (select count(*) from public.suppliers where workspace_id=ws and is_demo),
    'tasks',     (select count(*) from public.tasks t join public.projects p on p.id=t.project_id
                   where p.is_demo and p.workspace_id=ws),
    'stages_covered', (select count(distinct current_stage) from public.projects
                        where workspace_id=ws and is_demo),
    'real_untouched', real_after
  ) into result;

  return result;
end;
$$;

create or replace function public.demo_status()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'contacts', (select count(*) from public.contacts c
                  where c.workspace_id = public.current_workspace_id() and c.is_demo),
    'projects', (select count(*) from public.projects p
                  where p.workspace_id = public.current_workspace_id() and p.is_demo),
    'suppliers', (select count(*) from public.suppliers s
                  where s.workspace_id = public.current_workspace_id() and s.is_demo));
$$;

/* ------------------------------------------------------------------
   7. Grants. The seed helpers are internal — only the three callable
      from the UI are granted, and none of them to anon.
------------------------------------------------------------------ */

revoke all on function public.demo_seed_people(uuid)      from public, anon, authenticated;
revoke all on function public.demo_seed_projects(uuid)    from public, anon, authenticated;
revoke all on function public.demo_seed_supporting(uuid)  from public, anon, authenticated;
revoke all on function public.demo_flag_from_parent()     from public, anon, authenticated;

revoke all on function public.load_demo_data()  from public, anon;
revoke all on function public.reset_demo_data() from public, anon;
revoke all on function public.demo_status()     from public, anon;

grant execute on function public.load_demo_data()  to authenticated;
grant execute on function public.reset_demo_data() to authenticated;
grant execute on function public.demo_status()     to authenticated;
