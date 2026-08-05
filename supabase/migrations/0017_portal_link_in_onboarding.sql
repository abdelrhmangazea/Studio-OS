-- =============================================================
-- Studio OS — Bucket 6: put {{portal_link}} where the client will
-- actually receive it.
--
-- The field resolved but no template used it, so no client was ever
-- sent a portal link. The onboarding message is the right moment:
-- it is the message that already hands over the welcome pack, the
-- questionnaire, and the booking link.
--
-- This is a SURGICAL insert, not an overwrite. It adds one line
-- directly after the booking-link line, and only where that line is
-- still present and no portal line exists yet — so a studio that has
-- rewritten its own copy keeps every word of it.
-- =============================================================

-- 1. The master library, so "reset to defaults" restores it too.
update public.template_library
set body = replace(
      body,
      '• حجز اجتماع الانطلاق من هنا: {{booking_link}}',
      '• حجز اجتماع الانطلاق من هنا: {{booking_link}}' || E'\n' ||
      '• متابعة مشروعك أولاً بأول من هنا: {{portal_link}}'
    )
where key = 'onboarding_getting_started'
  and language = 'ar'
  and body like '%{{booking_link}}%'
  and body not like '%{{portal_link}}%';

update public.template_library
set body = replace(
      body,
      '• Book the kickoff meeting here: {{booking_link}}',
      '• Book the kickoff meeting here: {{booking_link}}' || E'\n' ||
      '• Follow your project here: {{portal_link}}'
    )
where key = 'onboarding_getting_started'
  and language = 'en'
  and body like '%{{booking_link}}%'
  and body not like '%{{portal_link}}%';


-- 2. And the copy already sitting in every workspace.
update public.templates
set body = replace(
      body,
      '• حجز اجتماع الانطلاق من هنا: {{booking_link}}',
      '• حجز اجتماع الانطلاق من هنا: {{booking_link}}' || E'\n' ||
      '• متابعة مشروعك أولاً بأول من هنا: {{portal_link}}'
    )
where key = 'onboarding_getting_started'
  and language = 'ar'
  and body like '%{{booking_link}}%'
  and body not like '%{{portal_link}}%';

update public.templates
set body = replace(
      body,
      '• Book the kickoff meeting here: {{booking_link}}',
      '• Book the kickoff meeting here: {{booking_link}}' || E'\n' ||
      '• Follow your project here: {{portal_link}}'
    )
where key = 'onboarding_getting_started'
  and language = 'en'
  and body like '%{{booking_link}}%'
  and body not like '%{{portal_link}}%';
