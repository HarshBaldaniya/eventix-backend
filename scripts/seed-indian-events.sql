-- Seed: Indian events (cricket, shows, concerts, festivals)
-- Run after schema. Events: name, description, capacity, status only.
-- Status: draft | coming_soon | published | cancelled | completed
-- Apostrophes in strings use $$...$$ to avoid escape issues.

INSERT INTO events (name, description, capacity, booked_count, status) VALUES
-- Cricket
('IPL 2025 Final - Mumbai Indians vs Chennai Super Kings', 'Indian Premier League 2025 Grand Finale at Wankhede Stadium, Mumbai. Witness the ultimate T20 showdown.', 45000, 0, 'published'),
('India vs Australia - Border Gavaskar Trophy 2025', 'Test match Day 1 at Eden Gardens, Kolkata. Experience the historic rivalry in the longest format.', 65000, 0, 'coming_soon'),
('India vs Pakistan - T20 World Cup Warm-up', 'High-voltage T20 clash at Narendra Modi Stadium, Ahmedabad. The biggest rivalry in cricket.', 132000, 0, 'published'),
('RCB vs KKR - IPL 2025 Bengaluru', 'Royal Challengers Bangalore host Kolkata Knight Riders at Chinnaswamy Stadium.', 40000, 0, 'published'),
('India vs England - ODI Series Mumbai', 'One Day International at Wankhede. Limited overs cricket at its finest.', 33000, 0, 'coming_soon'),
-- Comedy & Shows
('Kapil Sharma Comedy Show - Live in Delhi', 'An evening of laughter with Kapil Sharma and celebrity guests. Nita Mukesh Ambani Cultural Centre.', 1200, 0, 'published'),
('Vir Das - Landing Tour Bangalore', 'Stand-up comedy special. Vir Das brings his global tour to Bangalore.', 3500, 0, 'published'),
('Biswa Kalyan Rath - Sushi Tour Pune', 'Stand-up comedy. Biswa brings his unique humour to Pune.', 2000, 0, 'published'),
($$Kenny Sebastian - Don't Be That Guy - Hyderabad$$, 'Comedy special at Shilpakala Vedika.', 2500, 0, 'coming_soon'),
-- Music & Concerts
('A.R. Rahman - Live in Concert Mumbai', 'The Mozart of Madras performs his greatest hits. Jio World Garden, BKC.', 25000, 0, 'published'),
('Bollywood Night - Shah Rukh Khan Fan Meet', 'Exclusive fan meet and greet with King Khan. Includes Q and A, photo ops, and live performance.', 5000, 0, 'coming_soon'),
('Diwali Special - Amitabh Bachchan Live', 'Mega Diwali celebration with Big B. Fireworks, music, and star-studded evening.', 80000, 0, 'draft'),
($$Sunburn Festival 2025 - Goa$$, $$Asia's largest EDM festival. World-class DJs and electronic music.$$, 50000, 0, 'published'),
('Coke Studio India - Live Mumbai', 'Live recording with top Indian artists. Fusion of classical and contemporary.', 8000, 0, 'coming_soon'),
('Shreya Ghoshal - Symphony Tour Chennai', 'Melody queen performs her greatest hits at Nehru Indoor Stadium.', 12000, 0, 'published'),
-- Festivals & Cultural
('Holi Mela - Delhi', 'Colour festival celebration with music, dance, and traditional sweets.', 15000, 0, 'published'),
($$Durga Puja Pandals - Kolkata$$, $$Premium access to top pandals. Experience Bengal's biggest festival.$$, 5000, 0, 'coming_soon'),
('Onam Sadya - Kerala Cultural Evening', 'Traditional Onam feast with Kathakali performance. Kochi.', 3000, 0, 'published'),
('Garba Night - Navratri Special Ahmedabad', 'Nine nights of dance. Live dandiya and garba with top artists.', 20000, 0, 'published');

-- Per-event booking config (overrides default 6/15). High-demand events get stricter limits.
INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 4, 8 FROM events e WHERE e.name LIKE '%India vs Pakistan%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id);

INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 6, 12 FROM events e WHERE e.name LIKE '%IPL 2025 Final%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id);

INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 2, 4 FROM events e WHERE e.name LIKE '%Shah Rukh Khan Fan Meet%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id);

INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 4, 10 FROM events e WHERE e.name LIKE '%A.R. Rahman%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id);

INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 4, 8 FROM events e WHERE e.name LIKE '%Sunburn Festival%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id);

INSERT INTO event_booking_config (event_id, max_tickets_per_booking, max_tickets_per_user)
SELECT e.id, 10, 20 FROM events e WHERE e.name LIKE '%Holi Mela%' AND NOT EXISTS (SELECT 1 FROM event_booking_config WHERE event_id = e.id)
