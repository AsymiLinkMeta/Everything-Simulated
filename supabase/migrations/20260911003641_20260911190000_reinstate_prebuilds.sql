-- Reinstate two deleted prebuilds: haptic-racing-simulator and motion-racing-simulator

INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status)
SELECT 'haptic-racing-simulator', 'Haptic Racing Simulator', 'Most popular',
  'Hydraulic brake and seat transducers give you real feel without a motion platform.',
  'Everything Simulated Haptic Racing Simulator. The most popular home build we ship: Simagic Alpha 15Nm direct drive, GT NEO wheel, P1000-S hydraulic brake pedals, Exodus XR1 rig frame, haptic transducers on pedals and seat, triple 32-inch AOC 240Hz monitors, 27-inch aux, and a dedicated race PC. Assembled, QA''d and crated on the Gold Coast.',
  '/rigs/haptic.jpg', 1899900,
  '["15Nm direct drive wheel base","Hydraulic brake pedal feel","Seat and pedal transducers","Triple 32-inch + 27-inch aux"]'::jsonb,
  '{"Wheel base":"Simagic Alpha 15Nm","Wheel":"Simagic GT NEO","Pedals":"Simagic P1000-S hydraulic","Frame":"Exodus XR1","Monitors":"3x AOC 32-inch 240Hz + 27-inch aux","Haptics":"Seat + pedal transducers","PC":"Dedicated race PC"}'::jsonb,
  '["Haptic feedback","Lock-up feel","Kerb vibration","No motion platform needed"]'::jsonb,
  true, 2, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE slug = 'haptic-racing-simulator');

INSERT INTO prebuilds (slug, name, kicker, blurb, description, image, price_ex_gst, highlights, specs, capabilities, featured, sort_order, status)
SELECT 'motion-racing-simulator', 'Motion Racing Simulator', 'Flagship',
  'Full motion: heave, roll and pitch with SIMRIG SR2. The complete immersion rig.',
  'Everything Simulated Motion Racing Simulator. The flagship: Simagic Alpha 15Nm direct drive, GT NEO wheel, P1000-S hydraulic brake pedals, Exodus XR1 rig frame, SIMRIG SR2 motion platform with heave / roll / pitch, triple 32-inch AOC 240Hz monitors, 27-inch aux, and a dedicated race PC. Assembled, QA''d and crated on the Gold Coast. Requires payload check (driver + seat + screens under 225 kg).',
  '/rigs/motion.jpg', 2899900,
  '["SIMRIG SR2 motion platform","Heave / roll / pitch","15Nm direct drive","Triple 32-inch + 27-inch aux"]'::jsonb,
  '{"Wheel base":"Simagic Alpha 15Nm","Wheel":"Simagic GT NEO","Pedals":"Simagic P1000-S hydraulic","Frame":"Exodus XR1","Motion":"SIMRIG SR2","Monitors":"3x AOC 32-inch 240Hz + 27-inch aux","PC":"Dedicated race PC"}'::jsonb,
  '["Full motion","Heave roll pitch","Dedicated room recommended","Payload check required"]'::jsonb,
  true, 3, 'published'
WHERE NOT EXISTS (SELECT 1 FROM prebuilds WHERE slug = 'motion-racing-simulator');

INSERT INTO prebuild_components (prebuild_id, sku, qty, sort_order)
SELECT p.id, x.sku, x.qty, x.sort_order
FROM prebuilds p
JOIN (VALUES
  ('haptic-racing-simulator','xr1',1,0),
  ('haptic-racing-simulator','quad-mount',1,1),
  ('haptic-racing-simulator','touring-seat',1,2),
  ('haptic-racing-simulator','alpha-15',1,3),
  ('haptic-racing-simulator','gt-neo',1,4),
  ('haptic-racing-simulator','p1000-haptic',1,5),
  ('haptic-racing-simulator','seq-shifter',1,6),
  ('haptic-racing-simulator','aoc-32',3,7),
  ('haptic-racing-simulator','aux-27',1,8),
  ('haptic-racing-simulator','logi-surround',1,9),
  ('haptic-racing-simulator','pro-x',1,10),
  ('haptic-racing-simulator','iracing-12',1,11),
  ('haptic-racing-simulator','pc-race',1,12),
  ('motion-racing-simulator','xr1',1,0),
  ('motion-racing-simulator','quad-mount',1,1),
  ('motion-racing-simulator','touring-seat',1,2),
  ('motion-racing-simulator','alpha-15',1,3),
  ('motion-racing-simulator','gt-neo',1,4),
  ('motion-racing-simulator','p1000-haptic',1,5),
  ('motion-racing-simulator','seq-shifter',1,6),
  ('motion-racing-simulator','aoc-32',3,7),
  ('motion-racing-simulator','aux-27',1,8),
  ('motion-racing-simulator','logi-surround',1,9),
  ('motion-racing-simulator','pro-x',1,10),
  ('motion-racing-simulator','iracing-12',1,11),
  ('motion-racing-simulator','pc-race',1,12),
  ('motion-racing-simulator','sr2',1,13)
) AS x(slug, sku, qty, sort_order) ON x.slug = p.slug
WHERE NOT EXISTS (
  SELECT 1 FROM prebuild_components pc WHERE pc.prebuild_id = p.id
);
