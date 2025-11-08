-- Sample Data for BARQ Fleet Analytics
-- Creates sample hubs, drivers, customers, and orders for testing

-- 1. Insert sample hubs
INSERT INTO hubs (code, manager, mobile, latitude, longitude, is_active, opening_time, closing_time)
VALUES
  ('RYD-01', 'Ahmed Al-Rashid', '+966501234567', 24.7136, 46.6753, true, '06:00:00', '22:00:00'),
  ('JED-01', 'Mohammed Al-Otaibi', '+966502345678', 21.5433, 39.1728, true, '06:00:00', '22:00:00'),
  ('DMM-01', 'Khalid Al-Mutairi', '+966503456789', 26.4207, 50.0888, true, '07:00:00', '21:00:00')
ON CONFLICT DO NOTHING;

-- 2. Insert sample drivers
INSERT INTO drivers (employee_id, name, phone, email, vehicle_type, vehicle_number, status, current_latitude, current_longitude, rating)
VALUES
  ('DRV-001', 'Omar Hassan', '+966511111111', 'omar.hassan@barq.sa', 'MOTORCYCLE', 'ABC-1234', 'available', 24.7200, 46.6800, 4.8),
  ('DRV-002', 'Fahad Al-Qahtani', '+966512222222', 'fahad.qahtani@barq.sa', 'MOTORCYCLE', 'ABC-1235', 'available', 24.7300, 46.6900, 4.9),
  ('DRV-003', 'Abdullah Saeed', '+966513333333', 'abdullah.saeed@barq.sa', 'CAR', 'ABC-1236', 'available', 21.5500, 39.1800, 4.7),
  ('DRV-004', 'Saud Al-Harbi', '+966514444444', 'saud.harbi@barq.sa', 'MOTORCYCLE', 'ABC-1237', 'busy', 24.7100, 46.6700, 4.6),
  ('DRV-005', 'Faisal Al-Dawsari', '+966515555555', 'faisal.dawsari@barq.sa', 'CAR', 'ABC-1238', 'available', 26.4300, 50.1000, 4.9)
ON CONFLICT (employee_id) DO NOTHING;

-- 3. Insert sample customers
INSERT INTO customers (name, phone, email, language)
VALUES
  ('Sara Al-Malki', '+966521111111', 'sara.malki@example.com', 'ar'),
  ('Nora Al-Subaie', '+966522222222', 'nora.subaie@example.com', 'ar'),
  ('Layla Al-Dosari', '+966523333333', 'layla.dosari@example.com', 'ar'),
  ('Hala Al-Zahrani', '+966524444444', 'hala.zahrani@example.com', 'ar'),
  ('Reem Al-Shehri', '+966525555555', 'reem.shehri@example.com', 'ar'),
  ('Maha Al-Otaibi', '+966526666666', 'maha.otaibi@example.com', 'ar'),
  ('Nouf Al-Mutairi', '+966527777777', 'nouf.mutairi@example.com', 'ar'),
  ('Lina Al-Harbi', '+966528888888', 'lina.harbi@example.com', 'ar')
ON CONFLICT DO NOTHING;

-- 4. Insert sample orders
-- Using recent timestamps for realistic data
INSERT INTO orders (
  order_number, customer_id, driver_id, service_type, status,
  pickup_latitude, pickup_longitude, pickup_address,
  dropoff_latitude, dropoff_longitude, dropoff_address,
  estimated_distance, created_at, assigned_at, picked_up_at, delivered_at,
  sla_deadline, sla_breached, delivery_fee, surge_multiplier
) VALUES
  -- Delivered orders (BARQ - 1 hour SLA)
  ('ORD-0001', (SELECT id FROM customers LIMIT 1 OFFSET 0), (SELECT id FROM drivers LIMIT 1 OFFSET 0), 'BARQ', 'delivered',
   24.7123, 46.6734, '{"street": "King Fahd Road", "city": "Riyadh"}',
   24.7256, 46.6889, '{"street": "Olaya Street", "city": "Riyadh"}',
   8.5, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '115 minutes', NOW() - INTERVAL '105 minutes', NOW() - INTERVAL '65 minutes',
   NOW() - INTERVAL '1 hour', false, 35, 1.0),

  ('ORD-0002', (SELECT id FROM customers LIMIT 1 OFFSET 1), (SELECT id FROM drivers LIMIT 1 OFFSET 1), 'BARQ', 'delivered',
   24.7189, 46.6798, '{"street": "King Abdullah Road", "city": "Riyadh"}',
   24.7301, 46.6923, '{"street": "Prince Turki Street", "city": "Riyadh"}',
   12.3, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '175 minutes', NOW() - INTERVAL '165 minutes', NOW() - INTERVAL '120 minutes',
   NOW() - INTERVAL '2 hours', false, 45, 1.2),

  ('ORD-0003', (SELECT id FROM customers LIMIT 1 OFFSET 2), (SELECT id FROM drivers LIMIT 1 OFFSET 2), 'BARQ', 'delivered',
   21.5467, 39.1756, '{"street": "Tahlia Street", "city": "Jeddah"}',
   21.5523, 39.1823, '{"street": "Al Andalus Street", "city": "Jeddah"}',
   7.2, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '290 minutes', NOW() - INTERVAL '280 minutes', NOW() - INTERVAL '230 minutes',
   NOW() - INTERVAL '4 hours', true, 42, 1.5),

  -- Delivered orders (BULLET - 4 hour SLA)
  ('ORD-0004', (SELECT id FROM customers LIMIT 1 OFFSET 3), (SELECT id FROM drivers LIMIT 1 OFFSET 0), 'BULLET', 'delivered',
   24.7145, 46.6767, '{"street": "King Saud Road", "city": "Riyadh"}',
   24.7289, 46.6945, '{"street": "Makkah Road", "city": "Riyadh"}',
   15.8, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '355 minutes', NOW() - INTERVAL '340 minutes', NOW() - INTERVAL '180 minutes',
   NOW() - INTERVAL '2 hours', false, 55, 1.0),

  ('ORD-0005', (SELECT id FROM customers LIMIT 1 OFFSET 4), (SELECT id FROM drivers LIMIT 1 OFFSET 1), 'BULLET', 'delivered',
   26.4234, 50.0912, '{"street": "Dhahran Street", "city": "Dammam"}',
   26.4367, 50.1045, '{"street": "Corniche Road", "city": "Dammam"}',
   18.5, NOW() - INTERVAL '10 hours', NOW() - INTERVAL '595 minutes', NOW() - INTERVAL '580 minutes', NOW() - INTERVAL '360 minutes',
   NOW() - INTERVAL '6 hours', false, 62, 1.1),

  -- In transit orders
  ('ORD-0006', (SELECT id FROM customers LIMIT 1 OFFSET 5), (SELECT id FROM drivers LIMIT 1 OFFSET 3), 'BARQ', 'in_transit',
   24.7198, 46.6812, '{"street": "Riyadh Park", "city": "Riyadh"}',
   24.7334, 46.6978, '{"street": "Granada Mall", "city": "Riyadh"}',
   10.2, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '10 minutes', NULL,
   NOW() + INTERVAL '35 minutes', false, 38, 1.2),

  ('ORD-0007', (SELECT id FROM customers LIMIT 1 OFFSET 6), (SELECT id FROM drivers LIMIT 1 OFFSET 4), 'BARQ', 'in_transit',
   21.5489, 39.1789, '{"street": "Red Sea Mall", "city": "Jeddah"}',
   21.5567, 39.1856, '{"street": "Corniche Road", "city": "Jeddah"}',
   8.9, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes', NULL,
   NOW() + INTERVAL '45 minutes', false, 35, 1.0),

  -- Picked up orders
  ('ORD-0008', (SELECT id FROM customers LIMIT 1 OFFSET 7), (SELECT id FROM drivers LIMIT 1 OFFSET 2), 'BULLET', 'picked_up',
   24.7167, 46.6801, '{"street": "Panorama Mall", "city": "Riyadh"}',
   24.7412, 46.7023, '{"street": "Al Nakheel District", "city": "Riyadh"}',
   22.5, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '5 minutes', NULL,
   NOW() + INTERVAL '3.5 hours', false, 68, 1.3),

  -- Assigned orders
  ('ORD-0009', (SELECT id FROM customers LIMIT 1 OFFSET 0), (SELECT id FROM drivers LIMIT 1 OFFSET 0), 'BARQ', 'assigned',
   24.7223, 46.6845, '{"street": "Kingdom Tower", "city": "Riyadh"}',
   24.7367, 46.7012, '{"street": "Al Faisaliah Tower", "city": "Riyadh"}',
   11.3, NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '3 minutes', NULL, NULL,
   NOW() + INTERVAL '52 minutes', false, 41, 1.1),

  ('ORD-0010', (SELECT id FROM customers LIMIT 1 OFFSET 1), (SELECT id FROM drivers LIMIT 1 OFFSET 1), 'BARQ', 'assigned',
   21.5501, 39.1801, '{"street": "Jeddah Park", "city": "Jeddah"}',
   21.5589, 39.1878, '{"street": "Al Hamra District", "city": "Jeddah"}',
   9.7, NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '7 minutes', NULL, NULL,
   NOW() + INTERVAL '48 minutes', false, 37, 1.0),

  -- Pending orders
  ('ORD-0011', (SELECT id FROM customers LIMIT 1 OFFSET 2), NULL, 'BARQ', 'pending',
   24.7178, 46.6823, '{"street": "Tahlia Street", "city": "Riyadh"}',
   24.7345, 46.6989, '{"street": "Diplomatic Quarter", "city": "Riyadh"}',
   14.2, NOW() - INTERVAL '5 minutes', NULL, NULL, NULL,
   NOW() + INTERVAL '55 minutes', false, 48, 1.4),

  ('ORD-0012', (SELECT id FROM customers LIMIT 1 OFFSET 3), NULL, 'BULLET', 'pending',
   26.4256, 50.0934, '{"street": "Al Khobar", "city": "Dammam"}',
   26.4389, 50.1067, '{"street": "Half Moon Bay", "city": "Dammam"}',
   25.8, NOW() - INTERVAL '3 minutes', NULL, NULL, NULL,
   NOW() + INTERVAL '4 hours', false, 72, 1.0),

  -- Additional recent orders for analytics
  ('ORD-0013', (SELECT id FROM customers LIMIT 1 OFFSET 4), (SELECT id FROM drivers LIMIT 1 OFFSET 2), 'BARQ', 'delivered',
   24.7134, 46.6756, '{"street": "Al Malaz", "city": "Riyadh"}',
   24.7278, 46.6934, '{"street": "Al Murabba", "city": "Riyadh"}',
   9.8, NOW() - INTERVAL '1 hour 30 minutes', NOW() - INTERVAL '85 minutes', NOW() - INTERVAL '75 minutes', NOW() - INTERVAL '35 minutes',
   NOW() - INTERVAL '30 minutes', false, 39, 1.1),

  ('ORD-0014', (SELECT id FROM customers LIMIT 1 OFFSET 5), (SELECT id FROM drivers LIMIT 1 OFFSET 3), 'BARQ', 'delivered',
   24.7201, 46.6834, '{"street": "Al Olaya", "city": "Riyadh"}',
   24.7356, 46.7001, '{"street": "Al Sahafa", "city": "Riyadh"}',
   13.5, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '235 minutes', NOW() - INTERVAL '225 minutes', NOW() - INTERVAL '175 minutes',
   NOW() - INTERVAL '3 hours', true, 51, 1.6),

  ('ORD-0015', (SELECT id FROM customers LIMIT 1 OFFSET 6), (SELECT id FROM drivers LIMIT 1 OFFSET 4), 'BULLET', 'delivered',
   21.5478, 39.1767, '{"street": "Al Balad", "city": "Jeddah"}',
   21.5545, 39.1834, '{"street": "Al Rawdah", "city": "Jeddah"}',
   11.2, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '475 minutes', NOW() - INTERVAL '460 minutes', NOW() - INTERVAL '280 minutes',
   NOW() - INTERVAL '4 hours', false, 44, 1.2);

-- Display summary
SELECT
  'Sample data inserted successfully!' as message,
  (SELECT COUNT(*) FROM hubs) as hubs_count,
  (SELECT COUNT(*) FROM drivers) as drivers_count,
  (SELECT COUNT(*) FROM customers) as customers_count,
  (SELECT COUNT(*) FROM orders) as orders_count;
