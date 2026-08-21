import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Supabase ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://enrrsnbfushieufmqmuq.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucnJzbmJmdXNoaWV1Zm1xbXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTEyODEsImV4cCI6MjEwMDM4NzI4MX0.HzPvX-FXkGia2Ij53_Jnw_2Nrpzm212qy1HDiWUPUYU';
const JWT_SECRET = process.env.JWT_SECRET || 'civicflow-super-secret-jwt-key-2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const { data: user, error } = await supabase
    .from('cf_users')
    .select('*, cf_departments(name, code)')
    .eq('email', email.trim().toLowerCase())
    .single();

  if (error || !user) return fail(res, 404, 'User not found. Please check your email or register.');

  const token = generateToken(user);
  return ok(res, 200, { user, token }, 'Login successful');
});

app.post('/api/v1/auth/register', async (req, res) => {
  const { name, email, phone, role = 'citizen', department_id } = req.body;
  if (!name || !email) return fail(res, 400, 'Name and Email are required');

  const { data: existing } = await supabase.from('cf_users').select('id').eq('email', email.trim().toLowerCase()).single();
  if (existing) return fail(res, 409, 'User with this email already exists');

  const { data: newUser, error } = await supabase
    .from('cf_users')
    .insert([{ name, email: email.trim().toLowerCase(), phone: phone || null, role, department_id: department_id || null }])
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
app.get('/api/v1/departments', async (req, res) => {
  const { data, error } = await supabase.from('cf_departments').select('*').order('name');
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { departments: data }, 'Departments fetched');
});

// ── Complaints ────────────────────────────────────────────────────────────────
app.get('/api/v1/complaints', requireAuth, async (req, res) => {
  const { status, category, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let query = supabase.from('cf_complaints').select('*, cf_users(name, email), cf_departments(name, code)', { count: 'exact' });

  if (req.user.role === 'citizen') query = query.eq('citizen_id', req.user.id);
  if (req.user.role === 'officer') query = query.eq('department_id', req.user.department_id);
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

  let query = supabase.from('cf_complaints').select('*, cf_users(name, email, phone), cf_departments(name, code)');
  if (req.user.role === 'officer') query = query.eq('department_id', req.user.department_id);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { complaints: data }, 'All complaints fetched');
});

app.get('/api/v1/complaints/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('cf_complaints')
    .select('*, cf_users(name, email, phone), cf_departments(name, code), cf_complaint_updates(*, cf_users(name, role))')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return fail(res, 404, 'Complaint not found');
  return ok(res, 200, { complaint: data }, 'Complaint fetched');
});

app.post('/api/v1/complaints', requireAuth, async (req, res) => {
  const { title, description, category, location_text, latitude, longitude, image_base64 } = req.body;
  if (!title || !description || !category) return fail(res, 400, 'title, description, category are required');

  // Auto-assign department by category
  const categoryDeptMap = {
    road_damage: 'DEPT_ROADS', garbage: 'DEPT_GARBAGE', street_lights: 'DEPT_LIGHTS',
    drainage: 'DEPT_DRAIN', water_supply: 'DEPT_WATER', traffic: 'DEPT_TRAFFIC',
    pollution: 'DEPT_POLLUTION', public_property: 'DEPT_PWD'
  };

  const deptCode = categoryDeptMap[category];
  let department_id = null;
  if (deptCode) {
    const { data: dept } = await supabase.from('cf_departments').select('id').eq('code', deptCode).single();
    department_id = dept?.id || null;
  }

  const { data, error } = await supabase
    .from('cf_complaints')
    .insert([{
      citizen_id: req.user.id,
      title, description, category,
      location_text: location_text || null,
      latitude: latitude || null,
      longitude: longitude || null,
      image_base64: image_base64 || null,
      department_id,
      status: 'pending'
    }])
    .select('*, cf_users(name, email), cf_departments(name, code)')
    .single();

  if (error || !data) return fail(res, 500, `Failed to submit: ${error?.message}`);
  return ok(res, 201, { complaint: data }, 'Complaint submitted successfully');
});

app.patch('/api/v1/complaints/:id/status', requireAuth, async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { status, note } = req.body;

  const { data, error } = await supabase
    .from('cf_complaints')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !data) return fail(res, 500, `Update failed: ${error?.message}`);

  if (note) {
    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      status_changed_to: status,
      note
    }]);
  }

  return ok(res, 200, { complaint: data }, 'Status updated');
});

// ── Analytics (Admin) ─────────────────────────────────────────────────────────
app.get('/api/v1/analytics/summary', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');

  const { data: complaints } = await supabase.from('cf_complaints').select('status, created_at');
  const total = complaints?.length || 0;
  const pending = complaints?.filter(c => c.status === 'pending').length || 0;
  const inProgress = complaints?.filter(c => c.status === 'in_progress').length || 0;
  const resolved = complaints?.filter(c => c.status === 'resolved').length || 0;
  const critical = complaints?.filter(c => c.status === 'escalated').length || 0;

  return ok(res, 200, {
    total_complaints: total,
    pending_action: pending + inProgress,
    resolved_closed: resolved,
    critical_escalations: critical,
    resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0
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
      resolved: dc.filter(c => c.status === 'resolved').length,
      pending: dc.filter(c => c.status === 'pending').length
    };
  });

  return ok(res, 200, { data: result }, 'Department performance fetched');
});

// ── Notifications ─────────────────────────────────────────────────────────────
app.get('/api/v1/notifications', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('cf_notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { notifications: data }, 'Notifications fetched');
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
