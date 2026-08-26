import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    if (!origin || allowed.includes(origin) || allowed.some(o => origin.startsWith(o?.replace(/\/$/, '')))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NTFY_SECRET = process.env.NTFY_SECRET;

// Push real-time notification to ntfy.sh topics
const pushNtfy = async (userId, title, message) => {
  const topic = `civicflow-citizen-${userId}-${NTFY_SECRET}`;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags: ['bell'] })
    });
  } catch (e) { /* ntfy push is best-effort */ }
};

const pushNtfyToRole = async (role, title, message, departmentId) => {
  let topic;
  if (role === 'admin') topic = `civicflow-admin-${NTFY_SECRET}`;
  else if (role === 'officer' && departmentId) topic = `civicflow-officer-${departmentId}-${NTFY_SECRET}`;
  else if (role === 'worker' && departmentId) topic = `civicflow-worker-${departmentId}-${NTFY_SECRET}`;
  else return;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags: ['bell'] })
    });
  } catch (e) { /* best-effort */ }
};

const generateToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

const ok = (res, status, data, message) =>
  res.status(status).json({ success: true, statusCode: status, data, message });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, statusCode: status, message });

// ── Middleware: auth ──────────────────────────────────────────────────────────
const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return fail(res, 401, 'Unauthorized');
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const { data: user } = await supabase
      .from('cf_users')
      .select('*, cf_departments(name, code)')
      .eq('id', payload.id)
      .single();
    if (!user) return fail(res, 401, 'User not found');
    if (user.active === false) return fail(res, 403, 'Account is deactivated. Contact your administrator.');
    req.user = user;
    next();
  } catch {
    return fail(res, 401, 'Invalid token');
  }
};

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/api/v1/health', (req, res) => ok(res, 200, { status: 'ok', ts: new Date().toISOString() }, 'Server healthy'));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/v1/auth/login', async (req, res) => {
  const { email } = req.body;
  if (!email) return fail(res, 400, 'Email is required');

  const normalizedEmail = email.trim().toLowerCase();

  const { data: user, error } = await supabase
    .from('cf_users')
    .select('*, cf_departments(name, code)')
    .eq('email', normalizedEmail)
    .single();

  if (error || !user) return fail(res, 404, 'User not found. Please check your email or register.');
  if (user.active === false) return fail(res, 403, 'Account is deactivated. Contact your administrator.');

  const token = generateToken(user);
  return ok(res, 200, { user, token }, 'Login successful');
});

app.post('/api/v1/auth/register', async (req, res) => {
  const { name, email, phone, role = 'citizen', department_id } = req.body;
  if (!name || !email) return fail(res, 400, 'Name and Email are required');

  const normalizedEmail = email.trim().toLowerCase();

  const authHeader = req.headers.authorization;
  let callerRole = null;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const { data: callerUser } = await supabase.from('cf_users').select('role').eq('id', decoded.id).single();
      callerRole = callerUser?.role || null;
    } catch (_e) { /* invalid token, ignore */ }
  }

  let finalRole = (role || 'citizen').toLowerCase();
  if (callerRole !== 'admin') {
    finalRole = 'citizen';
  }

  const { data: existing } = await supabase.from('cf_users').select('id').eq('email', normalizedEmail).single();
  if (existing) return fail(res, 409, 'User with this email already exists');

  const { data: newUser, error } = await supabase
    .from('cf_users')
    .insert([{ name, email: normalizedEmail, phone: phone || null, role: finalRole, department_id: department_id || null }])
    .select('*, cf_departments(name, code)')
    .single();

  if (error || !newUser) return fail(res, 500, `Failed to register: ${error?.message}`);

  return ok(res, 201, { user: newUser, token: generateToken(newUser) }, 'Registered successfully');
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => ok(res, 200, { user: req.user }, 'Profile fetched'));

app.put('/api/v1/auth/profile', requireAuth, async (req, res) => {
  const { name, phone } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;

  const { data, error } = await supabase
    .from('cf_users')
    .update(updates)
    .eq('id', req.user.id)
    .select('*, cf_departments(name, code)')
    .single();

  if (error || !data) return fail(res, 500, `Update failed: ${error?.message}`);
  return ok(res, 200, { user: data }, 'Profile updated');
});

// ── Departments ───────────────────────────────────────────────────────────────
app.get('/api/v1/departments', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('cf_departments').select('*').order('name');
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { departments: data }, 'Departments fetched');
});

// ── Complaints ────────────────────────────────────────────────────────────────
app.get('/api/v1/complaints', requireAuth, async (req, res) => {
  const { status, category, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  // Explicit FK hint: !cf_complaints_citizen_id_fkey resolves ambiguity (cf_complaints has both citizen_id & assigned_officer_id → cf_users)
  let query = supabase.from('cf_complaints').select('*, cf_users!cf_complaints_citizen_id_fkey(name, email), cf_departments(name, code)', { count: 'exact' });

  if (req.user.role === 'citizen') query = query.eq('citizen_id', req.user.id);
  if (req.user.role === 'officer') {
    if (req.user.department_id) {
      query = query.or(`department_id.eq.${req.user.department_id},assigned_officer_id.eq.${req.user.id}`);
    } else {
      query = query.eq('assigned_officer_id', req.user.id);
    }
  }
  if (req.user.role === 'worker') {
    query = query.eq('assigned_worker_id', req.user.id);
  }
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  query = query.order('created_at', { ascending: false }).range(offset, offset + Number(limit) - 1);

  const { data, error, count } = await query;
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { complaints: data, total: count, page: Number(page), limit: Number(limit) }, 'Complaints fetched');
});

app.get('/api/v1/complaints/all', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { status, category } = req.query;

  let query = supabase.from('cf_complaints').select('*, cf_users!cf_complaints_citizen_id_fkey(name, email, phone), cf_departments(name, code)');
  if (req.user.role === 'officer') {
    if (req.user.department_id) {
      query = query.or(`department_id.eq.${req.user.department_id},assigned_officer_id.eq.${req.user.id}`);
    } else {
      query = query.eq('assigned_officer_id', req.user.id);
    }
  }
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { complaints: data }, 'All complaints fetched');
});

app.get('/api/v1/complaints/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cf_complaints')
    .select('*, cf_users!cf_complaints_citizen_id_fkey(name, email, phone), cf_departments(name, code), cf_complaint_updates(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return fail(res, 404, 'Complaint not found');
  const complaint = data;
  if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id) return fail(res, 403, 'Forbidden');
  if (req.user.role === 'officer') {
    const owns = complaint.assigned_officer_id === req.user.id;
    const inDept = complaint.department_id === req.user.department_id;
    if (!owns && !inDept) return fail(res, 403, 'Forbidden');
  }
  if (req.user.role === 'worker' && complaint.assigned_worker_id !== req.user.id) return fail(res, 403, 'Forbidden');
  return ok(res, 200, { complaint: data }, 'Complaint fetched');
});

app.post('/api/v1/complaints', requireAuth, async (req, res) => {
  const { title, description, category, priority, location_text, address, latitude, longitude, image_base64, image_url, geo_image_url } = req.body;
  if (!title || !description || !category) return fail(res, 400, 'title, description, category are required');

  // Auto-assign department by category code
  const categoryDeptMap = {
    road_damage: 'DEPT_ROADS', garbage: 'DEPT_GARBAGE', street_lights: 'DEPT_LIGHTS',
    drainage: 'DEPT_DRAIN', water_supply: 'DEPT_WATER', electricity: 'DEPT_LIGHTS',
    traffic: 'DEPT_TRAFFIC', pollution: 'DEPT_POLLUTION', public_property: 'DEPT_PWD', others: 'DEPT_PWD'
  };

  const deptCode = categoryDeptMap[category] || 'DEPT_PWD';
  let department_id = null;
  const { data: dept } = await supabase.from('cf_departments').select('id').eq('code', deptCode).single();
  department_id = dept?.id || null;

  const { data, error } = await supabase
    .from('cf_complaints')
    .insert([{
      citizen_id: req.user.id,
      title,
      description,
      category,
      address: address || location_text || 'Location not specified',
      latitude: parseFloat(latitude) || 0,
      longitude: parseFloat(longitude) || 0,
      image_url: image_url || image_base64 || null,
      geo_image_url: geo_image_url || null,
      department_id,
      status: 'submitted',
      ai_status: 'pending',
      priority: priority || 'medium'
    }])
    .select('*, cf_users!cf_complaints_citizen_id_fkey(name, email), cf_departments(name, code)')
    .single();

  if (error || !data) return fail(res, 500, `Failed to submit: ${error?.message}`);

  // Log initial audit entry
  await supabase.from('cf_complaint_updates').insert([{
    complaint_id: data.id,
    updated_by: req.user.id,
    old_status: null,
    new_status: 'submitted',
    remarks: 'Complaint submitted by citizen.'
  }]);

  // Notify citizen (confirmation)
  await supabase.from('cf_notifications').insert([{
    user_id: req.user.id,
    title: 'Complaint Registered',
    message: `Your complaint "${title}" has been submitted and is being processed.`,
    link_url: `/complaint/${data.id}`
  }]);
  pushNtfy(req.user.id, 'Complaint Registered', `Your complaint "${title}" has been submitted.`);

  // Notify all admins about new complaint
  const { data: admins } = await supabase.from('cf_users').select('id').eq('role', 'admin');
  if (admins?.length) {
    await supabase.from('cf_notifications').insert(
      admins.map(a => ({
        user_id: a.id,
        title: 'New Complaint Filed',
        message: `New complaint: "${title}" (${category}) has been submitted.`,
        link_url: `/complaint/${data.id}`
      }))
    );
    admins.forEach(a => pushNtfy(a.id, 'New Complaint Filed', `New: "${title}" (${category})`));
    pushNtfyToRole('admin', 'New Complaint Filed', `New: "${title}" (${category})`);
  }

  // Notify officers in the assigned department
  if (department_id) {
    const { data: officers } = await supabase.from('cf_users').select('id').eq('role', 'officer').eq('department_id', department_id);
    if (officers?.length) {
      await supabase.from('cf_notifications').insert(
        officers.map(o => ({
          user_id: o.id,
          title: 'New Complaint Assigned',
          message: `A new complaint "${title}" has been assigned to your department.`,
          link_url: `/complaint/${data.id}`
        }))
      );
      officers.forEach(o => pushNtfy(o.id, 'New Complaint Assigned', `"${title}" assigned to your dept.`));
      pushNtfyToRole('officer', 'New Complaint Assigned', `"${title}" assigned`, department_id);
    }
  }

  return ok(res, 201, { complaint: data }, 'Complaint submitted successfully');
});

app.patch('/api/v1/complaints/:id/status', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { status, remarks, proof_image_url, department_id } = req.body;

  // Fetch current complaint for audit log + citizen notification
  const { data: existing } = await supabase.from('cf_complaints').select('status, title, citizen_id, department_id').eq('id', req.params.id).single();

  const updates = { status, updated_at: new Date().toISOString() };
  if (department_id) updates.department_id = department_id;

  const { data, error } = await supabase
    .from('cf_complaints')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) return fail(res, 500, `Update failed: ${error?.message}`);

  // DB-011: Only log audit if status changed OR meaningful remarks/proof provided
  const statusChanged = existing?.status !== status;
  const hasMeaningfulData = remarks || proof_image_url || department_id;
  if (statusChanged || hasMeaningfulData) {
    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      old_status: existing?.status || null,
      new_status: status,
      remarks: remarks || (statusChanged ? `Status updated to ${status}` : `Department reassigned`),
      proof_image_url: proof_image_url || null
    }]);
  }

  // Create notification for the citizen who filed the complaint
  if (existing?.citizen_id) {
    const statusMsg = `Your complaint "${existing.title || 'Complaint'}" status was updated to ${status.replace(/_/g, ' ')}.`;
    await supabase.from('cf_notifications').insert([{
      user_id: existing.citizen_id,
      title: `Status Update: ${status.replace(/_/g, ' ').toUpperCase()}`,
      message: statusMsg,
      link_url: `/complaint/${req.params.id}`
    }]);
    pushNtfy(existing.citizen_id, 'Status Update', statusMsg);
  }

  // Also notify admins
  const { data: admins } = await supabase.from('cf_users').select('id').eq('role', 'admin');
  if (admins?.length) {
    const adminMsg = `"${existing?.title || 'Complaint'}" status changed to ${status.replace(/_/g, ' ')}.`;
    await supabase.from('cf_notifications').insert(
      admins.map(a => ({
        user_id: a.id,
        title: 'Complaint Status Changed',
        message: adminMsg,
        link_url: `/complaint/${req.params.id}`
      }))
    );
    admins.forEach(a => pushNtfy(a.id, 'Complaint Status Changed', adminMsg));
    pushNtfyToRole('admin', 'Complaint Status Changed', adminMsg);
  }

  return ok(res, 200, { complaint: data }, 'Status updated');
});

app.post('/api/v1/complaints/:id/withdraw', requireAuth, async (req, res) => {
  const { reason } = req.body;
  const { data: complaint, error: fetchErr } = await supabase
    .from('cf_complaints')
    .select('id, title, status, citizen_id')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !complaint) return fail(res, 404, 'Complaint not found');
  if (complaint.citizen_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  if (['closed', 'resolved', 'withdrawn'].includes(complaint.status)) return fail(res, 400, 'Complaint already resolved/withdrawn');

  const { data, error } = await supabase
    .from('cf_complaints')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return fail(res, 500, `Withdraw failed: ${error.message}`);

  await supabase.from('cf_complaint_updates').insert([{
    complaint_id: req.params.id,
    updated_by: req.user.id,
    old_status: complaint.status,
    new_status: 'withdrawn',
    remarks: reason ? `Withdrawn: ${reason}` : 'Complaint withdrawn by citizen.'
  }]);

  return ok(res, 200, { complaint: data }, 'Complaint withdrawn');
});

app.post('/api/v1/complaints/:id/rating', requireAuth, async (req, res) => {
  const { rating_score, feedback } = req.body;
  if (!rating_score || rating_score < 1 || rating_score > 5) return fail(res, 400, 'Rating score must be 1-5');

  const { data: complaint } = await supabase.from('cf_complaints').select('id, citizen_id, status').eq('id', req.params.id).single();
  if (!complaint) return fail(res, 404, 'Complaint not found');
  if (complaint.citizen_id !== req.user.id) return fail(res, 403, 'Only the reporting citizen can rate');
  if (!['resolved', 'closed'].includes(complaint.status)) return fail(res, 400, 'Can only rate resolved/closed complaints');

  const { data, error } = await supabase.from('cf_ratings').insert([{
    complaint_id: req.params.id,
    citizen_id: req.user.id,
    rating_score,
    feedback: feedback || null
  }]).select('*').single();

  if (error) return fail(res, 500, `Rating failed: ${error.message}`);
  return ok(res, 201, { rating: data }, 'Rating submitted');
});

app.delete('/api/v1/complaints/:id', requireAuth, async (req, res) => {
  const { data: complaint, error: fetchErr } = await supabase
    .from('cf_complaints')
    .select('id, title, status, citizen_id')
    .eq('id', req.params.id)
    .single();

  if (fetchErr || !complaint) return fail(res, 404, 'Complaint not found');

  if (req.user.role === 'citizen') {
    if (complaint.citizen_id !== req.user.id) return fail(res, 403, 'You can only delete your own complaints');
    if (complaint.status !== 'submitted') return fail(res, 400, 'Only submitted complaints can be deleted');
  }

  // Cascade delete related records
  await supabase.from('cf_ratings').delete().eq('complaint_id', req.params.id);
  await supabase.from('cf_complaint_updates').delete().eq('complaint_id', req.params.id);
  await supabase.from('cf_notifications').delete().eq('link_url', `/complaint/${req.params.id}`);

  const { error } = await supabase.from('cf_complaints').delete().eq('id', req.params.id);
  if (error) return fail(res, 500, `Delete failed: ${error.message}`);

  return ok(res, 200, null, 'Complaint deleted');
});

// ── Analytics (Admin) ─────────────────────────────────────────────────────────
app.get('/api/v1/analytics/summary', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');

  const { data: complaints } = await supabase.from('cf_complaints').select('status, category, created_at');
  const { data: users } = await supabase.from('cf_users').select('id, role');
  const { data: departments } = await supabase.from('cf_departments').select('id');

  const total = complaints?.length || 0;
  // Real DB statuses: submitted | under_review | assigned | in_progress | resolved | closed | rejected | withdrawn
  const pendingAction = complaints?.filter(c => ['submitted', 'under_review', 'assigned', 'in_progress'].includes(c.status)).length || 0;
  const resolved = complaints?.filter(c => c.status === 'resolved' || c.status === 'closed').length || 0;
  const rejected = complaints?.filter(c => c.status === 'rejected' || c.status === 'withdrawn').length || 0;

  return ok(res, 200, {
    total_complaints: total,
    pending_action: pendingAction,
    resolved_closed: resolved,
    critical_escalations: rejected,
    resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    total_users: users?.length || 0,
    total_officers: users?.filter(u => u.role === 'officer').length || 0,
    total_departments: departments?.length || 0
  }, 'Analytics summary fetched');
});

app.get('/api/v1/analytics/complaints-by-category', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  const { data } = await supabase.from('cf_complaints').select('category');
  const counts = {};
  data?.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  const result = Object.entries(counts).map(([category, count]) => ({ category, count }));
  return ok(res, 200, { data: result }, 'Category breakdown fetched');
});

app.get('/api/v1/analytics/department-performance', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  const { data: depts } = await supabase.from('cf_departments').select('id, name, code');
  const { data: complaints } = await supabase.from('cf_complaints').select('department_id, status');

  const result = depts?.map(dept => {
    const dc = complaints?.filter(c => c.department_id === dept.id) || [];
    return {
      department: dept.name,
      code: dept.code,
      total: dc.length,
      resolved: dc.filter(c => c.status === 'resolved' || c.status === 'closed').length,
      pending: dc.filter(c => !['resolved', 'closed', 'rejected', 'withdrawn'].includes(c.status)).length
    };
  });

  return ok(res, 200, { data: result }, 'Department performance fetched');
});

// ── Worker Routes ─────────────────────────────────────────────────────────────
app.get('/api/v1/worker/tasks', requireAuth, async (req, res) => {
  if (req.user.role !== 'worker') return fail(res, 403, 'Forbidden');
  const { status } = req.query;

  let query = supabase.from('cf_complaints')
    .select('*, cf_departments(name, code), cf_users!cf_complaints_citizen_id_fkey(name, email)')
    .eq('assigned_worker_id', req.user.id);

  if (status) query = query.eq('status', status);
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { tasks: data || [] }, 'Worker tasks fetched');
});

app.post('/api/v1/worker/tasks/:id/update', requireAuth, async (req, res) => {
  if (req.user.role !== 'worker') return fail(res, 403, 'Forbidden');
  const { update_type, remarks, proof_image_url, geo_image_url, latitude, longitude } = req.body;
  if (!update_type || !remarks) return fail(res, 400, 'update_type and remarks are required');

  // Verify this task is assigned to this worker
  const { data: complaint } = await supabase.from('cf_complaints')
    .select('id, title, citizen_id, assigned_worker_id, status')
    .eq('id', req.params.id).single();

  if (!complaint) return fail(res, 404, 'Task not found');
  if (complaint.assigned_worker_id !== req.user.id) return fail(res, 403, 'This task is not assigned to you');

  // Insert worker update
  const { data, error } = await supabase.from('cf_worker_updates').insert([{
    complaint_id: req.params.id,
    worker_id: req.user.id,
    update_type,
    remarks,
    proof_image_url: proof_image_url || null,
    geo_image_url: geo_image_url || null,
    latitude: latitude ? parseFloat(latitude) : null,
    longitude: longitude ? parseFloat(longitude) : null
  }]).select('*').single();

  if (error) return fail(res, 500, `Update failed: ${error.message}`);

  // If worker marks completed, update complaint status to resolved
  if (update_type === 'completed') {
    await supabase.from('cf_complaints')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      old_status: complaint.status,
      new_status: 'resolved',
      remarks: `Work completed by field worker: ${remarks}`,
      proof_image_url: proof_image_url || null
    }]);

    // Notify citizen
    if (complaint.citizen_id) {
      const resolveMsg = `Your complaint "${complaint.title}" has been resolved by field worker.`;
      await supabase.from('cf_notifications').insert([{
        user_id: complaint.citizen_id,
        title: 'Complaint Resolved',
        message: resolveMsg,
        link_url: `/complaint/${req.params.id}`
      }]);
      pushNtfy(complaint.citizen_id, 'Complaint Resolved', resolveMsg);
    }
  } else if (update_type === 'accepted' || update_type === 'in_progress') {
    // Update complaint status to in_progress
    const newStatus = 'in_progress';
    await supabase.from('cf_complaints')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      old_status: complaint.status,
      new_status: newStatus,
      remarks: `Worker update (${update_type}): ${remarks}`
    }]);
  }

  return ok(res, 201, { update: data }, 'Worker update submitted');
});

app.get('/api/v1/complaints/:id/worker-updates', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('cf_worker_updates')
    .select('*, worker:cf_users!cf_worker_updates_worker_id_fkey(name, role)')
    .eq('complaint_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { updates: data || [] }, 'Worker updates fetched');
});

app.patch('/api/v1/complaints/:id/assign-worker', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { worker_id } = req.body;
  if (!worker_id) return fail(res, 400, 'worker_id is required');

  const { data: complaint } = await supabase.from('cf_complaints')
    .select('id, title, status').eq('id', req.params.id).single();
  if (!complaint) return fail(res, 404, 'Complaint not found');

  // DB-005: Don't regress status if complaint already resolved or closed
  const TERMINAL_STATUSES = ['resolved', 'closed'];
  const newStatus = TERMINAL_STATUSES.includes(complaint.status) ? complaint.status : 'assigned';

  const { data, error } = await supabase.from('cf_complaints')
    .update({ assigned_worker_id: worker_id, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', req.params.id).select().single();

  if (error) return fail(res, 500, `Assignment failed: ${error.message}`);

  // Log audit only if status actually changed
  await supabase.from('cf_complaint_updates').insert([{
    complaint_id: req.params.id,
    updated_by: req.user.id,
    old_status: complaint.status,
    new_status: newStatus,
    remarks: `Worker assigned${complaint.status === newStatus ? ' (status preserved — already ' + newStatus + ')' : ' for dispatch'}.`
  }]);

  // Notify worker
  const assignMsg = `You have been assigned to: "${complaint.title}". Check your dashboard.`;
  await supabase.from('cf_notifications').insert([{
    user_id: worker_id,
    title: 'New Task Assigned',
    message: assignMsg,
    link_url: `/complaint/${req.params.id}`
  }]);
  pushNtfy(worker_id, 'New Task Assigned', assignMsg);

  return ok(res, 200, { complaint: data }, 'Worker assigned');
});

app.get('/api/v1/workers', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  let query = supabase.from('cf_users').select('id, name, email, phone, department_id, active, created_at, cf_departments(name, code)').eq('role', 'worker');
  if (req.user.role === 'officer' && req.user.department_id) {
    query = query.eq('department_id', req.user.department_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { workers: data || [] }, 'Workers list fetched');
});

// Update worker info (admin/officer)
app.patch('/api/v1/workers/:id', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { name, phone, department_id } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (department_id && req.user.role === 'admin') updates.department_id = department_id;
  const { data, error } = await supabase.from('cf_users').update(updates).eq('id', req.params.id).eq('role', 'worker').select('*').single();
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { worker: data }, 'Worker updated');
});

// Toggle worker active/inactive
app.patch('/api/v1/workers/:id/status', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { active } = req.body;
  const { data, error } = await supabase.from('cf_users').update({ active: !!active }).eq('id', req.params.id).eq('role', 'worker').select('*').single();
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { worker: data }, `Worker marked ${active ? 'active' : 'inactive'}`);
});

// Delete worker
app.delete('/api/v1/workers/:id', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Only admins can delete workers');
  // Unassign from any complaints first
  await supabase.from('cf_complaints').update({ assigned_worker_id: null }).eq('assigned_worker_id', req.params.id);
  const { error } = await supabase.from('cf_users').delete().eq('id', req.params.id).eq('role', 'worker');
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, {}, 'Worker deleted');
});

// ── Notifications ─────────────────────────────────────────────────────────────
app.get('/api/v1/notifications', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cf_notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return fail(res, 500, error.message);

  const unreadCount = (data || []).filter(n => !n.is_read).length;
  return ok(res, 200, { notifications: data || [], unreadCount }, 'Notifications fetched');
});

app.get('/api/v1/notifications/ntfy-topics', requireAuth, (req, res) => {
  const topics = [];

  // Personal topic for everyone (receives direct notifications)
  topics.push(`civicflow-citizen-${req.user.id}-${NTFY_SECRET}`);

  if (req.user.role === 'admin') {
    topics.push(`civicflow-admin-${NTFY_SECRET}`);
  }

  if (req.user.role === 'officer' && req.user.department_id) {
    topics.push(`civicflow-officer-${req.user.department_id}-${NTFY_SECRET}`);
  }

  if (req.user.role === 'worker' && req.user.department_id) {
    topics.push(`civicflow-worker-${req.user.department_id}-${NTFY_SECRET}`);
  }

  return ok(res, 200, { topics }, 'ntfy topics retrieved');
});

app.patch('/api/v1/notifications/read-all', requireAuth, async (req, res) => {
  await supabase.from('cf_notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
  return ok(res, 200, {}, 'All notifications marked read');
});

app.patch('/api/v1/notifications/:id/read', requireAuth, async (req, res) => {
  await supabase.from('cf_notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
  return ok(res, 200, {}, 'Notification marked read');
});

// ── Catch-all 404 ─────────────────────────────────────────────────────────────
app.use((req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  fail(res, err.statusCode || 500, err.message || 'Internal server error');
});

export default app;
