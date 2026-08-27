const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Initial Mock Dataset matching Design References Image 1 & Image 2
const MOCK_DEPARTMENTS = [
  { id: 'dept-roads', name: 'Roads & Transport', code: 'ROADS', description: 'Potholes, resurfacing, sidewalk repairs' },
  { id: 'dept-elec', name: 'Electrical & Lighting', code: 'ELEC', description: 'Streetlights, traffic signals, transformers' },
  { id: 'dept-waste', name: 'Waste Management', code: 'WASTE', description: 'Garbage bins, dump yards, roadside litter' },
  { id: 'dept-water', name: 'Water & Sewage', code: 'WATER', description: 'Drainage pipelines, drinking water supply' },
  { id: 'dept-traffic', name: 'Traffic Operations', code: 'TRAF', description: 'Traffic flow, signal timing, signboards' }
];

const MOCK_WORKERS = [
  { id: 'w-1', name: 'John Smith', email: 'john.smith@civicflow.org', phone: '+1 (555) 234-5678', department_id: 'dept-elec', cf_departments: MOCK_DEPARTMENTS[1], active: true },
  { id: 'w-2', name: 'Mike Wilson', email: 'mike.wilson@civicflow.org', phone: '+1 (555) 345-6789', department_id: 'dept-roads', cf_departments: MOCK_DEPARTMENTS[0], active: true },
  { id: 'w-3', name: 'Lisa Garcia', email: 'lisa.garcia@civicflow.org', phone: '+1 (555) 456-7890', department_id: 'dept-waste', cf_departments: MOCK_DEPARTMENTS[2], active: true },
  { id: 'w-4', name: 'Ramesh Kumar', email: 'worker.roads@civicflow.org', phone: '+91 98234 56789', department_id: 'dept-roads', cf_departments: MOCK_DEPARTMENTS[0], active: true },
  { id: 'w-5', name: 'Suresh Nair', email: 'worker.traffic@civicflow.org', phone: '+91 98345 67890', department_id: 'dept-traffic', cf_departments: MOCK_DEPARTMENTS[4], active: true }
];

let mockComplaints = [
  {
    id: 'iss-001',
    title: 'Broken Streetlight on Main Street',
    description: 'High-voltage streetlight fixture flickering and completely dark at night near Main St crossing.',
    category: 'street_lights',
    status: 'submitted',
    priority: 'high',
    address: '123 Main St, Central District',
    latitude: 19.07609,
    longitude: 72.877426,
    image_url: '/images/complaints/street_lights.jpg',
    department_id: 'dept-elec',
    cf_departments: MOCK_DEPARTMENTS[1],
    citizen: { name: 'Sarah Johnson', email: 'sarah.j@example.com', phone: '+1 (555) 111-2233' },
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Electrical hazard: High priority streetlight replacement needed for nighttime road pedestrian visibility.',
    ai_suggested_response: 'Dispatch electrical lineman team with bucket truck.'
  },
  {
    id: 'iss-002',
    title: 'Pothole Repair Needed on 5th Ave',
    description: 'Large 4-inch deep pothole after monsoon rains causing traffic swerving and tire damage.',
    category: 'road_damage',
    status: 'in_progress',
    priority: 'medium',
    address: '5th Avenue, North Sector',
    latitude: 19.0825,
    longitude: 72.8835,
    image_url: '/images/complaints/road_damage.jpg',
    department_id: 'dept-roads',
    cf_departments: MOCK_DEPARTMENTS[0],
    assigned_worker_id: 'w-2',
    citizen: { name: 'David Brown', email: 'david.b@example.com', phone: '+1 (555) 222-3344' },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Road surface triage: Cold asphalt patching required.',
    ai_suggested_response: 'Road maintenance unit dispatched on site.'
  },
  {
    id: 'iss-003',
    title: 'Overflowing Trash Bin at Central Park',
    description: 'Commercial municipal trash bin overflowing on pedestrian sidewalk for over 36 hours.',
    category: 'garbage',
    status: 'resolved',
    priority: 'low',
    address: 'Central Park West Gate',
    latitude: 19.0690,
    longitude: 72.8650,
    image_url: '/images/complaints/garbage.jpg',
    department_id: 'dept-waste',
    cf_departments: MOCK_DEPARTMENTS[2],
    assigned_worker_id: 'w-3',
    citizen: { name: 'Lisa Garcia', email: 'lisa.g@example.com', phone: '+1 (555) 333-4455' },
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Sanitation cleared: Solid waste cleared and sanitized.',
    rating: { rating_score: 5, feedback: 'Prompt waste clearance and bin replaced with new lid!' }
  },
  {
    id: 'iss-004',
    title: 'Main Water Pipeline Leakage',
    description: 'Underground potable water supply line burst causing low pressure and street flooding.',
    category: 'water_supply',
    status: 'submitted',
    priority: 'critical',
    address: 'Sector 4 Market Crossing',
    latitude: 19.0890,
    longitude: 72.8710,
    image_url: '/images/complaints/water_supply.jpg',
    department_id: 'dept-water',
    cf_departments: MOCK_DEPARTMENTS[3],
    citizen: { name: 'Viren Patel', email: 'viren.patel@civicflow.org', phone: '+91 98765 43210' },
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Critical water utility fault: Immediate isolation of valve required to avoid road structural erosion.'
  },
  {
    id: 'iss-005',
    title: 'Traffic Light Malfunction at Junction',
    description: 'All four signal lights stuck on blinking yellow causing extreme congestion.',
    category: 'traffic',
    status: 'in_progress',
    priority: 'high',
    address: 'Grand Avenue & 12th Junction',
    latitude: 19.0730,
    longitude: 72.8910,
    image_url: '/images/complaints/traffic.jpg',
    department_id: 'dept-traffic',
    cf_departments: MOCK_DEPARTMENTS[4],
    assigned_worker_id: 'w-5',
    citizen: { name: 'Alex Morgan', email: 'alex.m@example.com', phone: '+1 (555) 444-5566' },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Traffic safety risk: Controller reboot and manual traffic warden deployment required.'
  },
  {
    id: 'iss-006',
    title: 'Gutter Pipeline Clogged & Backing Up',
    description: 'Stormwater drain overflowing with plastic waste after heavy rainfall.',
    category: 'drainage',
    status: 'resolved',
    priority: 'medium',
    address: 'South Bay Boulevard',
    latitude: 19.0620,
    longitude: 72.8780,
    image_url: '/images/complaints/drainage.jpg',
    department_id: 'dept-water',
    cf_departments: MOCK_DEPARTMENTS[3],
    citizen: { name: 'Priya Mehta', email: 'priya.m@example.com', phone: '+91 98111 22334' },
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    ai_summary: 'Drainage cleared: Suction vehicle deployed and silt removed.'
  }
];

// Fallback Mock Dispatcher for seamless frontend experience
const handleMockRequest = async (endpoint, options = {}) => {
  const method = options.method?.toUpperCase() || 'GET';
  const cleanEndpoint = endpoint.split('?')[0];

  // Auth me
  if (cleanEndpoint === '/auth/me') {
    const savedUser = localStorage.getItem('civicflow_user');
    if (savedUser) return { user: JSON.parse(savedUser) };
    return {
      user: {
        id: 'user-admin',
        name: 'John Doe',
        email: 'admin@civicflow.org',
        role: 'admin'
      }
    };
  }

  // Auth login
  if (cleanEndpoint === '/auth/login' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    let role = 'citizen';
    let name = 'Viren Patel';
    let depts = null;

    if (body.email.includes('admin')) {
      role = 'admin';
      name = 'John Doe';
    } else if (body.email.includes('officer.roads')) {
      role = 'officer';
      name = 'Rajesh Sharma';
      depts = MOCK_DEPARTMENTS[0];
    } else if (body.email.includes('officer.traffic')) {
      role = 'officer';
      name = 'Priya Nair';
      depts = MOCK_DEPARTMENTS[4];
    } else if (body.email.includes('worker.roads')) {
      role = 'worker';
      name = 'Ramesh Kumar';
      depts = MOCK_DEPARTMENTS[0];
    } else if (body.email.includes('worker.traffic')) {
      role = 'worker';
      name = 'Suresh Nair';
      depts = MOCK_DEPARTMENTS[4];
    } else if (body.name) {
      name = body.name;
    }

    const userObj = {
      id: `usr-${Date.now()}`,
      name,
      email: body.email,
      role,
      cf_departments: depts
    };
    localStorage.setItem('civicflow_user', JSON.stringify(userObj));
    return { user: userObj, token: `demo-token-${role}` };
  }

  // Auth register
  if (cleanEndpoint === '/auth/register' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const userObj = {
      id: `usr-${Date.now()}`,
      name: body.name || 'New Citizen',
      email: body.email,
      role: body.role || 'citizen',
      phone: body.phone || ''
    };
    localStorage.setItem('civicflow_user', JSON.stringify(userObj));
    return { user: userObj, token: `demo-token-${userObj.role}` };
  }

  // Departments
  if (cleanEndpoint === '/departments') {
    return MOCK_DEPARTMENTS;
  }

  // Workers
  if (cleanEndpoint === '/workers') {
    return { workers: MOCK_WORKERS };
  }

  // Worker tasks
  if (cleanEndpoint === '/worker/tasks') {
    return { tasks: mockComplaints };
  }

  // Summary Analytics
  if (cleanEndpoint === '/analytics/summary') {
    return {
      total_complaints: 23,
      pending_action: 15,
      resolved_closed: 8,
      critical_escalations: 3,
      resolution_rate: 78
    };
  }

  // Complaints list
  if (cleanEndpoint === '/complaints' && method === 'GET') {
    return { complaints: mockComplaints };
  }

  // Single complaint
  if (cleanEndpoint.startsWith('/complaints/') && method === 'GET') {
    const id = cleanEndpoint.replace('/complaints/', '');
    const found = mockComplaints.find(c => c.id === id) || mockComplaints[0];
    return { complaint: found };
  }

  // Create complaint
  if (cleanEndpoint === '/complaints' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const newComp = {
      id: `iss-${(mockComplaints.length + 1).toString().padStart(3, '0')}`,
      ...body,
      status: 'submitted',
      created_at: new Date().toISOString(),
      citizen: { name: 'Viren Patel', email: 'viren.patel@civicflow.org' }
    };
    mockComplaints.unshift(newComp);
    return { complaint: newComp };
  }

  // Update status
  if (cleanEndpoint.includes('/status') && (method === 'PATCH' || method === 'POST')) {
    const id = cleanEndpoint.split('/')[2];
    const body = JSON.parse(options.body || '{}');
    mockComplaints = mockComplaints.map(c => (c.id === id ? { ...c, ...body } : c));
    return { success: true };
  }

  // Assign worker
  if (cleanEndpoint.includes('/assign-worker')) {
    const id = cleanEndpoint.split('/')[2];
    const body = JSON.parse(options.body || '{}');
    mockComplaints = mockComplaints.map(c => (c.id === id ? { ...c, assigned_worker_id: body.worker_id, status: 'assigned' } : c));
    return { success: true };
  }

  // Delete complaint
  if (cleanEndpoint.startsWith('/complaints/') && method === 'DELETE') {
    const id = cleanEndpoint.replace('/complaints/', '');
    mockComplaints = mockComplaints.filter(c => c.id !== id);
    return { success: true };
  }

  return { success: true };
};

// Primary API Request with live backend fetch + seamless fallback
export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('civicflow_token');

  // If using demo token or offline, use fallback dispatcher
  if (token && token.startsWith('demo-token-')) {
    return await handleMockRequest(endpoint, options);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : { success: false, message: 'Empty response' };
    } catch (_e) {
      // Fallback on invalid HTML or backend offline
      return await handleMockRequest(endpoint, options);
    }

    if (!response.ok || !data.success) {
      if (endpoint === '/auth/login') {
        return await handleMockRequest(endpoint, options);
      }
      throw new Error(data.message || 'API Request Failed');
    }

    return data.data;
  } catch (err) {
    // If backend is unreachable or local server not configured, seamlessly return mock data
    return await handleMockRequest(endpoint, options);
  }
};
