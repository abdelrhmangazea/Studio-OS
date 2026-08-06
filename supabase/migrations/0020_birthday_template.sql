-- =============================================================
-- Studio OS — Bucket 7: the birthday message
--
-- The birthday reminder had a kind but no template to hang off. The
-- other eight follow-up and occasion messages all existed; this one
-- did not, so it is written here in the same register as the rest of
-- the occasion library: short, warm, and with nothing to sell.
--
-- A birthday reminder is only ever created for a contact who has a
-- birthday recorded. Nothing here infers or guesses one.
-- =============================================================

insert into public.template_library (key, type, channel, stage, language, title, subject, body, sort_order)
values (
  'occasion_birthday', 'message', 'email', '10_followup', 'ar',
  'عيد ميلاد',
  'كل عام وأنت بخير {{client_first_name}} 🎂',
$body$كل عام وأنت بخير {{client_first_name}} 🎂

أتمنى لك سنة مليئة بالصحة والسعادة، وبكل ما تتمناه.

تحياتي،
{{designer_name}}$body$,
  20
),
(
  'occasion_birthday', 'message', 'email', '10_followup', 'en',
  'Birthday',
  'Happy birthday, {{client_first_name}} 🎂',
$body$Happy birthday, {{client_first_name}} 🎂

Wishing you a year full of health and happiness, and everything you hope for.

Warm regards,
{{designer_name}}$body$,
  20
)
on conflict (key, language) do update
  set type       = excluded.type,
      channel    = excluded.channel,
      stage      = excluded.stage,
      title      = excluded.title,
      subject    = excluded.subject,
      body       = excluded.body,
      sort_order = excluded.sort_order;


-- Into every workspace that already exists. ON CONFLICT DO NOTHING,
-- so nothing anyone has edited is touched.
do $$
declare ws uuid;
begin
  for ws in select id from public.workspaces loop
    perform public.seed_workspace_templates(ws);
  end loop;
end;
$$;
