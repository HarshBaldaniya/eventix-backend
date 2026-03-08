-- Eventix Seed Data (SCALE UP)
-- Run: npm run db:seed
-- Users: admin@eventix.com (Admin@123), user@eventix.com (User@123)

BEGIN;

-- 1. Seed users (admin + normal). Skip if already exist.
INSERT INTO public.users (email, password_hash, name, role)
VALUES
  (
    'admin@eventix.com',
    '$2b$10$Yt1KtmG4Wo85J1BAenToE.42t3QnCfD/6OcLc4I1RGvzySdSWdmey',
    'Admin User',
    'admin'
  ),
  (
    'user@eventix.com',
    '$2b$10$kt7Vj51IOwmrIR9uL7WELuLkeN1OnjexpWPTDBUODjrmDBNp6pdTG',
    'Regular User',
    'user'
  )
ON CONFLICT (email) DO NOTHING;

-- 2. Seed events (13–17 events, capacity 25–300, mix of draft / coming_soon / published)
INSERT INTO public.events (name, description, capacity, booked_count, status, created_at)
VALUES
  (
    'Navratri Garba Night 2026',
    'A grand Garba and Dandiya celebration in Ahmedabad featuring live folk bands, colorful traditional dance performances, festive food courts, and family seating zones.',
    150,
    0,
    'published',
    now() - interval '22 minutes'
  ),
  (
    'Sunburn Goa EDM Weekend 2026',
    'One of Asia''s largest electronic dance music festivals with world-class DJs, beachside stages, VIP access lounges, and night-long music performances.',
    250,
    0,
    'coming_soon',
    now() - interval '20 minutes'
  ),
  (
    'Jaipur Literature Festival 2026',
    'An internationally recognized literature festival bringing together global authors, thinkers, poets, and readers for discussions, book launches, and panel sessions.',
    120,
    0,
    'published',
    now() - interval '18 minutes'
  ),
  (
    'Diwali Lights Festival Delhi 2026',
    'A festive evening celebration featuring decorative lighting displays, fireworks shows, food stalls, and cultural performances for families and tourists.',
    200,
    0,
    'coming_soon',
    now() - interval '16 minutes'
  ),
  (
    'Tech Conference India Bangalore 2026',
    'A full-day technology conference covering AI, cloud computing, product engineering, startup innovation, and networking opportunities for developers and founders.',
    150,
    0,
    'draft',
    now() - interval '14 minutes'
  ),
  (
    'Pushkar Camel Fair Cultural Festival 2026',
    'A unique cultural event showcasing camel parades, traditional Rajasthani dance, folk music performances, handicraft markets, and local cuisine.',
    80,
    0,
    'published',
    now() - interval '12 minutes'
  ),
  (
    'India vs New Zealand T20 World Cup 2026 Final - Premium Match Pass',
    'Premium stadium tickets for the India vs New Zealand T20 World Cup Final including priority entry, reserved seating, fan zones, and hospitality food packages.',
    95,
    0,
    'published',
    now() - interval '10 minutes'
  ),
  (
    'India vs New Zealand T20 World Cup 2026 Final - VIP Hospitality Box',
    'Exclusive VIP hospitality suite tickets for the World Cup final with lounge seating, gourmet catering, concierge service, and premium viewing decks.',
    50,
    0,
    'published',
    now() - interval '8 minutes'
  ),
  (
    'IPL 2026 Grand Final - Premium Stadium Ticket',
    'Premium stadium seating for the IPL 2026 Grand Final featuring top teams battling for the championship. Includes priority stadium entry and fan zone access.',
    120,
    0,
    'published',
    now() - interval '6 minutes'
  ),
  (
    'IPL 2026 Grand Final - VIP Corporate Hospitality Box',
    'Ultra premium IPL final experience with corporate hospitality lounge access, premium seating deck, gourmet catering, concierge service and private viewing areas.',
    75,
    0,
    'published',
    now() - interval '4 minutes'
  ),
  (
    'Startup Founders Meetup Bangalore 2026',
    'A networking meetup for startup founders, engineers, and investors featuring product demos, founder talks, and curated networking sessions.',
    60,
    0,
    'draft',
    now() - interval '2 minutes'
  ),
  (
    'Mumbai New Year Harbour Party 2026',
    'A large New Year celebration with live DJs, fireworks over the harbour, premium dinner packages, and countdown entertainment.',
    180,
    0,
    'coming_soon',
    now()
  ),
  (
    'Chennai Music Festival 2026',
    'A multi-genre music festival featuring Carnatic, fusion, and contemporary artists. Open-air venue with food stalls and artist meet-and-greet.',
    150,
    0,
    'coming_soon',
    now() - interval '25 minutes'
  ),
  (
    'Holi Color Festival Mumbai 2026',
    'Celebrate Holi with organic colors, live music, traditional sweets, and water play zones. Family-friendly event with safety measures.',
    200,
    0,
    'coming_soon',
    now() - interval '30 minutes'
  ),
  (
    'Design Summit Delhi 2026',
    'A design-focused conference for UX/UI designers, product managers, and creative leads. Workshops, keynotes, and portfolio reviews.',
    90,
    0,
    'draft',
    now() - interval '35 minutes'
  );

-- 3. Per-event booking config for 2–3 events (different limits; others use default 6/15)
INSERT INTO public.event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 4, 8
FROM public.events e
WHERE e.name = 'Navratri Garba Night 2026'
  AND NOT EXISTS (SELECT 1 FROM event_booking_config c WHERE c.event_id = e.id);

INSERT INTO public.event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 2, 4
FROM public.events e
WHERE e.name = 'IPL 2026 Grand Final - VIP Corporate Hospitality Box'
  AND NOT EXISTS (SELECT 1 FROM event_booking_config c WHERE c.event_id = e.id);

INSERT INTO public.event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 8, 20
FROM public.events e
WHERE e.name = 'India vs New Zealand T20 World Cup 2026 Final - Premium Match Pass'
  AND NOT EXISTS (SELECT 1 FROM event_booking_config c WHERE c.event_id = e.id);

COMMIT;
