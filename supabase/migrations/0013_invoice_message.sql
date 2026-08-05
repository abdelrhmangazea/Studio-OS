-- =============================================================
-- Studio OS — Bucket 5 follow-up: the invoice covering message
--
-- B5 built invoice issuing but never the message that goes with it,
-- which the spec asked for. This adds the missing template.
--
-- The merge fields it needs already exist in the registry:
--   invoice_amount  — was prompt-only; now auto-resolves from a real
--                     invoice when one is passed to the generator
--   currency        — auto, from studio_settings
--   payment_method  — prompt; there is no bank-details column to read
--
-- Channel is 'email' to match contract_send and fee_proposal_send —
-- the other two messages that accompany a document. The generator's
-- WhatsApp export works regardless of the channel label.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Into the master library
-- -------------------------------------------------------------

insert into public.template_library (key, type, channel, stage, language, title, subject, body, sort_order)
values (
  'invoice_send', 'message', 'email', '01_consultation', 'ar',
  'إرسال الفاتورة',
  'فاتورة {{project_name}}',
$body$أهلاً {{client_first_name}}،

مرفق فاتورة {{project_name}}.

المبلغ: {{invoice_amount}} {{currency}}
كود المشروع: {{project_code}}
التاريخ: {{today_date}}

طريقة السداد: {{payment_method}}

بعد التحويل، أرسل لي صورة الإيصال ليتم تأكيد الدفعة.

يسعدني الإجابة على أي استفسار بخصوص الفاتورة.

تحياتي،
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$body$,
  10
),
(
  'invoice_send', 'message', 'email', '01_consultation', 'en',
  'Send Invoice',
  'Invoice — {{project_name}}',
$body$Hi {{client_first_name}},

Attached is the invoice for {{project_name}}.

Amount: {{invoice_amount}} {{currency}}
Project code: {{project_code}}
Date: {{today_date}}

Payment method: {{payment_method}}

Once you've transferred, please send me a copy of the receipt so I can confirm the payment.

Happy to answer any question about the invoice.

Best regards,
{{designer_name}}
{{designer_title}}
{{designer_phone}} | {{designer_website}}$body$,
  10
)
on conflict (key, language) do update
  set type       = excluded.type,
      channel    = excluded.channel,
      stage      = excluded.stage,
      title      = excluded.title,
      subject    = excluded.subject,
      body       = excluded.body,
      sort_order = excluded.sort_order;


-- -------------------------------------------------------------
-- 2. And into every workspace that already exists
--
-- seed_workspace_templates is ON CONFLICT DO NOTHING, so this only
-- adds the new key. Nothing anyone has edited is touched.
-- -------------------------------------------------------------

do $$
declare
  ws uuid;
begin
  for ws in select id from public.workspaces loop
    perform public.seed_workspace_templates(ws);
  end loop;
end;
$$;
