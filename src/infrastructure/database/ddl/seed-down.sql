-- Eventix Seed Data (SCALE DOWN)
-- Run: npm run db:seed:down
-- Removes all seed users, events, and related data.

BEGIN;

-- 1. Delete bookings for seed events (before deleting events)
DELETE FROM public.bookings
WHERE event_id IN (
  SELECT id FROM public.events
  WHERE name IN (
    'Navratri Garba Night 2026',
    'Sunburn Goa EDM Weekend 2026',
    'Jaipur Literature Festival 2026',
    'Diwali Lights Festival Delhi 2026',
    'Tech Conference India Bangalore 2026',
    'Pushkar Camel Fair Cultural Festival 2026',
    'India vs New Zealand T20 World Cup 2026 Final - Premium Match Pass',
    'India vs New Zealand T20 World Cup 2026 Final - VIP Hospitality Box',
    'IPL 2026 Grand Final - Premium Stadium Ticket',
    'IPL 2026 Grand Final - VIP Corporate Hospitality Box',
    'Startup Founders Meetup Bangalore 2026',
    'Mumbai New Year Harbour Party 2026',
    'Chennai Music Festival 2026',
    'Holi Color Festival Mumbai 2026',
    'Design Summit Delhi 2026'
  )
);

-- 2. Delete seed events (CASCADE: event_booking_config, event_audit_log, booking_audit_log)
DELETE FROM public.events
WHERE name IN (
  'Navratri Garba Night 2026',
  'Sunburn Goa EDM Weekend 2026',
  'Jaipur Literature Festival 2026',
  'Diwali Lights Festival Delhi 2026',
  'Tech Conference India Bangalore 2026',
  'Pushkar Camel Fair Cultural Festival 2026',
  'India vs New Zealand T20 World Cup 2026 Final - Premium Match Pass',
  'India vs New Zealand T20 World Cup 2026 Final - VIP Hospitality Box',
  'IPL 2026 Grand Final - Premium Stadium Ticket',
  'IPL 2026 Grand Final - VIP Corporate Hospitality Box',
  'Startup Founders Meetup Bangalore 2026',
  'Mumbai New Year Harbour Party 2026',
  'Chennai Music Festival 2026',
  'Holi Color Festival Mumbai 2026',
  'Design Summit Delhi 2026'
);

-- 3. Delete sessions for seed users
DELETE FROM public.sessions
WHERE user_id IN (SELECT id FROM public.users WHERE email IN ('admin@eventix.com', 'user@eventix.com'));

-- 4. Delete seed users
DELETE FROM public.users
WHERE email IN ('admin@eventix.com', 'user@eventix.com');

COMMIT;
