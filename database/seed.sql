-- CivicFlow Safe-Zone Seed Script

INSERT INTO public.cf_departments (name, code, description, category) VALUES
('Roads & Infrastructure', 'DEPT_ROADS', 'Handles pothole repairs, street pavement, and road hazards.', 'road_damage'),
('Sanitation & Waste Management', 'DEPT_GARBAGE', 'Handles garbage collection, waste dumping, and street cleaning.', 'garbage'),
('Electrical & Street Lighting', 'DEPT_LIGHTS', 'Handles non-functional streetlights and electrical wiring issues.', 'street_lights'),
('Drainage & Sewage', 'DEPT_DRAIN', 'Handles unclogging drains, sewage overflows, and storm gutters.', 'drainage'),
('Water Supply Department', 'DEPT_WATER', 'Handles main water pipe leaks and supply disruptions.', 'water_supply'),
('Traffic Operations', 'DEPT_TRAFFIC', 'Handles signal failures, traffic congestion, and road signs.', 'traffic'),
('Environmental Protection', 'DEPT_POLLUTION', 'Handles air/noise pollution and toxic discharge reporting.', 'pollution'),
('Public Works Department', 'DEPT_PWD', 'Handles general public property damage and unassigned civic issues.', 'public_property')
ON CONFLICT (code) DO NOTHING;

-- Seed Initial Test Users
INSERT INTO public.cf_users (id, name, email, phone, role) VALUES
('11111111-1111-1111-1111-111111111111', 'Civic Admin', 'admin@civicflow.org', '+1999000001', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.cf_users (id, name, email, phone, role, department_id) VALUES
('22222222-2222-2222-2222-222222222222', 'Officer Rajesh Sharma', 'officer.roads@civicflow.org', '+1999000002', 'officer', (SELECT id FROM public.cf_departments WHERE code = 'DEPT_ROADS'))
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.cf_users (id, name, email, phone, role) VALUES
('33333333-3333-3333-3333-333333333333', 'Pratham Solanki', 'pratham.citizen@civicflow.org', '+1999000003', 'citizen')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.cf_complaints (
    id, title, description, category, priority, status, ai_status,
    ai_summary, ai_suggested_response, ai_confidence,
    latitude, longitude, address, image_url, citizen_id, department_id
) VALUES (
    '44444444-4444-4444-4444-444444444444',
    'Severe Pothole on Main MG Road',
    'Dangerous deep pothole near sector 4 crossing causing vehicle damage and traffic slowdown.',
    'road_damage',
    'high',
    'submitted',
    'completed',
    'Major pothole obstructing main traffic vein.',
    'Road repair crew scheduled for inspection within 24 hours.',
    0.92,
    19.076090,
    72.877426,
    'MG Road Crossing, Sector 4, Mumbai',
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80',
    '33333333-3333-3333-3333-333333333333',
    (SELECT id FROM public.cf_departments WHERE code = 'DEPT_ROADS')
) ON CONFLICT (id) DO NOTHING;
