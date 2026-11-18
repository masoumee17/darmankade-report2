-- یک‌بار در SQL Editor همان پروژه اجرا شود؛ اطلاعات موجود را تغییر نمی‌دهد.
-- فقط داده‌های همین گزارش و لینک فایل‌های مرتبط برای بازدیدکننده عمومی خواندنی است.
-- دسترسی مستقیم به جدول‌ها، اطلاعات اعضا و اجازه ویرایش عمومی ایجاد نمی‌شود.
begin;

create or replace function public.milestone_public_report()
returns table (id text, content jsonb)
language sql
stable
security definer
set search_path = ''
as $function$
  select s.id,
    pg_catalog.jsonb_build_object('tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.item->'id',
        'project', t.item->'project',
        'title', t.item->'title',
        'description', t.item->'description',
        'type', t.item->'type',
        'unit', t.item->'unit',
        'total', t.item->'total',
        'done', t.item->'done',
        'status', t.item->'status',
        'monthlyCapacity', t.item->'monthlyCapacity',
        'monthlyGoal', t.item->'monthlyGoal',
        'monthlyAchieved', t.item->'monthlyAchieved',
        'pageMetric', t.item->'pageMetric',
        'documentUrl', t.item->'documentUrl'
      ) order by t.position)
      from pg_catalog.jsonb_array_elements(coalesce(s.content->'tasks', '[]'::jsonb))
        with ordinality as t(item, position)
      where t.item->>'project' = s.id
    ), '[]'::jsonb))
    || case when s.id = 'platform' then pg_catalog.jsonb_build_object(
      'platformSummary', pg_catalog.jsonb_build_object(
        'total', s.content#>'{platformSummary,total}',
        'done', s.content#>'{platformSummary,done}',
        'breakdownConfirmed', s.content#>'{platformSummary,breakdownConfirmed}',
        'note', s.content#>'{platformSummary,note}'
      ),
      'campaigns', pg_catalog.jsonb_build_object(
        'scopeCount', s.content#>'{campaigns,scopeCount}',
        'monthlyGoal', s.content#>'{campaigns,monthlyGoal}',
        'records', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'month', m.item->'month',
            'label', m.item->'label',
            'completed', m.item->'completed'
          ) order by m.position)
          from pg_catalog.jsonb_array_elements(coalesce(s.content#>'{campaigns,records}', '[]'::jsonb))
            with ordinality as m(item, position)
        ), '[]'::jsonb)
      )
    ) else '{}'::jsonb end
  from public.milestone_sections as s
  where s.id in ('blog', 'platform', 'health');
$function$;

revoke all on function public.milestone_public_report() from public, anon, authenticated;
grant execute on function public.milestone_public_report() to anon, authenticated;
comment on function public.milestone_public_report() is
  'Public read-only projection of milestone report fields. No member accounts or write privileges.';

commit;

-- نتیجه باید سه ردیف برای blog و platform و health باشد.
select r.id, pg_catalog.jsonb_array_length(r.content->'tasks') as activity_count
from public.milestone_public_report() as r
order by r.id;
