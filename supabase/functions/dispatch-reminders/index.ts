import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: due, error } = await supabase
    .from('reminders')
    .select('id, user_id, event_id, events(title, date), profiles(expo_push_token)')
    .eq('sent', false)
    .lte('remind_at', new Date().toISOString());

  if (error) return new Response(error.message, { status: 500 });
  if (!due?.length) return new Response('none due', { status: 200 });

  const messages = due
    .filter(r => r.profiles?.expo_push_token)
    .map(r => ({
      to: r.profiles.expo_push_token,
      title: 'Upcoming event',
      body: `${r.events.title} is coming up`,
      data: { eventId: r.event_id },
    }));

  if (messages.length) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages),
    });
  }

  await supabase.from('reminders').update({ sent: true }).in('id', due.map(r => r.id));

  return new Response(`dispatched ${messages.length}`, { status: 200 });
});
