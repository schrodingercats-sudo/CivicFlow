import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const app = express();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const staticAllowed = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://civicflow-app.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);
  if (staticAllowed.includes(origin)) return true;
  const lower = origin.toLowerCase();
  if (lower.endsWith('.vercel.app')) return true;
  if (lower.startsWith('http://localhost:') || lower.startsWith('http://127.0.0.1:')) return true;
  return staticAllowed.some(o => lower.startsWith(o.replace(/\/$/, '').toLowerCase()));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  preflightContinue: true,
  optionsSuccessStatus: 204
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid JSON body' });
  }
  next(err);
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'civicflow-dev-secret-change-me';
const NTFY_SECRET = process.env.NTFY_SECRET || 'civicflow-dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const pushNtfy = async (userId, title, message) => {
  if (!userId || !title || !message) return;
  const topic = `civicflow-citizen-${userId}-${NTFY_SECRET}`;
  try {
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, tags: ['bell'] })
    });
  } catch (_e) { /* best-effort */ }
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
  } catch (_e) { /* best-effort */ }
};

const generateToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

const ok = (res, status, data, message) =>
  res.status(status).json({ success: true, statusCode: status, data, message });

const fail = (res, status, message) =>
  res.status(status).json({ success: false, statusCode: status, message });

const safeFirst = (sbResult) => {
  const { data, error } = sbResult;
  if (error) return { value: null, error };
  if (Array.isArray(data)) return { value: data[0] || null, error: null };
  return { value: data || null, error: null };
};

const wrap = (handler) => async (req, res, next) => {
  try {
    if (res.headersSent) return;
    await handler(req, res, next);
  } catch (err) {
    if (res.headersSent) return;
    console.error('[API] Unhandled error:', err);
    fail(res, err?.statusCode || 500, err?.message || 'Internal server error');
  }
};

const requireAuth = wrap(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return fail(res, 401, 'Unauthorized');
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const { value: user, error } = safeFirst(
      await supabase
        .from('cf_users')
        .select('*, cf_departments(name, code)')
        .eq('id', payload.id)
        .limit(1)
    );
    if (error || !user) return fail(res, 401, 'User not found');
    if (user.active === false) return fail(res, 403, 'Account is deactivated. Contact your administrator.');
    req.user = user;
    next();
  } catch (_e) {
    return fail(res, 401, 'Invalid token');
  }
});

app.get('/api/v1/health', (req, res) => ok(res, 200, { status: 'ok', ts: new Date().toISOString() }, 'Server healthy'));

app.post('/api/v1/auth/login', wrap(async (req, res) => {
  const { email } = req.body || {};
  if (!email) return fail(res, 400, 'Email is required');
  const normalizedEmail = email.trim().toLowerCase();
  const { value: user, error } = safeFirst(
    await supabase
      .from('cf_users')
      .select('*, cf_departments(name, code)')
      .eq('email', normalizedEmail)
      .limit(1)
  );
  if (error || !user) return fail(res, 404, 'User not found. Please check your email or register.');
  if (user.active === false) return fail(res, 403, 'Account is deactivated. Contact your administrator.');
  const token = generateToken(user);
  return ok(res, 200, { user, token }, 'Login successful');
}));

app.post('/api/v1/auth/register', wrap(async (req, res) => {
  const { name, email, phone, role = 'citizen', department_id } = req.body || {};
  if (!name || !email) return fail(res, 400, 'Name and Email are required');
  const normalizedEmail = email.trim().toLowerCase();

  let callerRole = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const { value: callerUser } = safeFirst(
        await supabase.from('cf_users').select('role').eq('id', decoded.id).limit(1)
      );
      callerRole = callerUser?.role || null;
    } catch (_e) { /* ignore */ }
  }

  const finalRole = callerRole === 'admin' ? (role || 'citizen').toLowerCase() : 'citizen';

  const { value: existing } = safeFirst(
    await supabase.from('cf_users').select('id').eq('email', normalizedEmail).limit(1)
  );
  if (existing) return fail(res, 409, 'User with this email already exists');

  const { data: inserted, error: insErr } = await supabase
    .from('cf_users')
    .insert([{
      name,
      email: normalizedEmail,
      phone: phone || null,
      role: finalRole,
      department_id: department_id || null
    }])
    .select('*, cf_departments(name, code)');

  if (insErr || !inserted?.length) return fail(res, 500, `Failed to register: ${insErr?.message || 'Unknown'}`);
  const newUser = inserted[0];
  return ok(res, 201, { user: newUser, token: generateToken(newUser) }, 'Registered successfully');
}));

app.get('/api/v1/auth/me', requireAuth, (req, res) => ok(res, 200, { user: req.user }, 'Profile fetched'));

app.put('/api/v1/auth/profile', requireAuth, wrap(async (req, res) => {
  const { name, phone } = req.body || {};
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (Object.keys(updates).length === 0) return ok(res, 200, { user: req.user }, 'No changes');
  const { data, error } = await supabase
    .from('cf_users')
    .update(updates)
    .eq('id', req.user.id)
    .select('*, cf_departments(name, code)');
  if (error || !data?.length) return fail(res, 500, `Update failed: ${error?.message || 'Unknown'}`);
  return ok(res, 200, { user: data[0] }, 'Profile updated');
}));

app.get('/api/v1/departments', requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase.from('cf_departments').select('*').order('name');
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { departments: data }, 'Departments fetched');
}));

const CITIZEN_FK = 'cf_users!cf_complaints_citizen_id_fkey(name, email)';
const CITIZEN_FK_FULL = 'cf_users!cf_complaints_citizen_id_fkey(name, email, phone)';

app.get('/api/v1/complaints', requireAuth, wrap(async (req, res) => {
  const { status, category, page = 1, limit = 20 } = req.query;
  const pg = Math.max(1, Number(page) || 1);
  const lm = Math.max(1, Math.min(100, Number(limit) || 20));
  const offset = (pg - 1) * lm;

  let query = supabase
    .from('cf_complaints')
    .select(`*, ${CITIZEN_FK}, cf_departments(name, code)`, { count: 'exact' });

  if (req.user.role === 'citizen') query = query.eq('citizen_id', req.user.id);
  if (req.user.role === 'officer') {
    if (req.user.department_id) {
      query = query.or(`department_id.eq.${req.user.department_id},assigned_officer_id.eq.${req.user.id}`);
    } else {
      query = query.eq('assigned_officer_id', req.user.id);
    }
  }
  if (req.user.role === 'worker') query = query.eq('assigned_worker_id', req.user.id);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  query = query.order('created_at', { ascending: false }).range(offset, offset + lm - 1);
  const { data, error, count } = await query;
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { complaints: data, total: count, page: pg, limit: lm }, 'Complaints fetched');
}));

app.get('/api/v1/complaints/all', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { status, category } = req.query;
  let query = supabase
    .from('cf_complaints')
    .select(`*, ${CITIZEN_FK_FULL}, cf_departments(name, code)`);
  if (req.user.role === 'officer') {
    if (req.user.department_id) {
      query = query.or(`department_id.eq.${req.user.department_id},assigned_officer_id.eq.${req.user.id}`);
    } else {
      query = query.eq('assigned_officer_id', req.user.id);
    }
  }
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { complaints: data }, 'All complaints fetched');
}));

app.get('/api/v1/complaints/:id', requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('cf_complaints')
    .select(`*, ${CITIZEN_FK_FULL}, cf_departments(name, code), cf_complaint_updates(*)`)
    .eq('id', req.params.id)
    .limit(1);
  if (error || !data?.length) return fail(res, 404, 'Complaint not found');
  const complaint = data[0];
  if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id) return fail(res, 403, 'Forbidden');
  if (req.user.role === 'officer') {
    const owns = complaint.assigned_officer_id === req.user.id;
    const inDept = complaint.department_id === req.user.department_id;
    if (!owns && !inDept) return fail(res, 403, 'Forbidden');
  }
  if (req.user.role === 'worker' && complaint.assigned_worker_id !== req.user.id) return fail(res, 403, 'Forbidden');
  return ok(res, 200, { complaint }, 'Complaint fetched');
}));

app.post('/api/v1/complaints', requireAuth, wrap(async (req, res) => {
  const { title, description, category, priority, location_text, address, latitude, longitude, image_base64, image_url, geo_image_url } = req.body || {};
  if (!title || !description || !category) return fail(res, 400, 'title, description, category are required');

  const categoryDeptMap = {
    road_damage: 'DEPT_ROADS', garbage: 'DEPT_GARBAGE', street_lights: 'DEPT_LIGHTS',
    drainage: 'DEPT_DRAIN', water_supply: 'DEPT_WATER', electricity: 'DEPT_LIGHTS',
    traffic: 'DEPT_TRAFFIC', pollution: 'DEPT_POLLUTION', public_property: 'DEPT_PWD', others: 'DEPT_PWD'
  };
  const deptCode = categoryDeptMap[category] || 'DEPT_PWD';
  const { value: dept } = safeFirst(
    await supabase.from('cf_departments').select('id').eq('code', deptCode).limit(1)
  );
  const department_id = dept?.id || null;

  const { data: inserted, error: insErr } = await supabase
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
    .select(`*, ${CITIZEN_FK}, cf_departments(name, code)`);

  if (insErr || !inserted?.length) return fail(res, 500, `Failed to submit: ${insErr?.message || 'Unknown'}`);
  const created = inserted[0];

  try {
    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: created.id,
      updated_by: req.user.id,
      old_status: null,
      new_status: 'submitted',
      remarks: 'Complaint submitted by citizen.'
    }]);
  } catch (_e) { /* non-fatal */ }

  try {
    await supabase.from('cf_notifications').insert([{
      user_id: req.user.id,
      title: 'Complaint Registered',
      message: `Your complaint "${title}" has been submitted and is being processed.`,
      link_url: `/complaint/${created.id}`
    }]);
  } catch (_e) { /* non-fatal */ }
  pushNtfy(req.user.id, 'Complaint Registered', `Your complaint "${title}" has been submitted.`);

  try {
    const { data: admins } = await supabase.from('cf_users').select('id').eq('role', 'admin');
    if (admins?.length) {
      await supabase.from('cf_notifications').insert(
        admins.map(a => ({
          user_id: a.id,
          title: 'New Complaint Filed',
          message: `New complaint: "${title}" (${category}) has been submitted.`,
          link_url: `/complaint/${created.id}`
        }))
      );
      admins.forEach(a => pushNtfy(a.id, 'New Complaint Filed', `New: "${title}" (${category})`));
      pushNtfyToRole('admin', 'New Complaint Filed', `New: "${title}" (${category})`);
    }
  } catch (_e) { /* non-fatal */ }

  if (department_id) {
    try {
      const { data: officers } = await supabase
        .from('cf_users')
        .select('id')
        .eq('role', 'officer')
        .eq('department_id', department_id);
      if (officers?.length) {
        await supabase.from('cf_notifications').insert(
          officers.map(o => ({
            user_id: o.id,
            title: 'New Complaint Assigned',
            message: `A new complaint "${title}" has been assigned to your department.`,
            link_url: `/complaint/${created.id}`
          }))
        );
        officers.forEach(o => pushNtfy(o.id, 'New Complaint Assigned', `"${title}" assigned to your dept.`));
        pushNtfyToRole('officer', 'New Complaint Assigned', `"${title}" assigned`, department_id);
      }
    } catch (_e) { /* non-fatal */ }
  }

  return ok(res, 201, { complaint: created }, 'Complaint submitted successfully');
}));

app.patch('/api/v1/complaints/:id/status', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { status, remarks, proof_image_url, department_id } = req.body || {};
  if (!status) return fail(res, 400, 'status is required');

  const { value: existing } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, status, title, citizen_id, department_id')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!existing) return fail(res, 404, 'Complaint not found');

  const updates = { status, updated_at: new Date().toISOString() };
  if (department_id) updates.department_id = department_id;

  const { data, error } = await supabase
    .from('cf_complaints')
    .update(updates)
    .eq('id', req.params.id)
    .select();

  if (error || !data?.length) return fail(res, 500, `Update failed: ${error?.message || 'Unknown'}`);

  const statusChanged = existing.status !== status;
  const hasMeaningfulData = remarks || proof_image_url || department_id;
  if (statusChanged || hasMeaningfulData) {
    try {
      await supabase.from('cf_complaint_updates').insert([{
        complaint_id: req.params.id,
        updated_by: req.user.id,
        old_status: existing.status || null,
        new_status: status,
        remarks: remarks || (statusChanged ? `Status updated to ${status}` : `Department reassigned`),
        proof_image_url: proof_image_url || null
      }]);
    } catch (_e) { /* non-fatal */ }
  }

  if (existing.citizen_id) {
    try {
      const statusMsg = `Your complaint "${existing.title || 'Complaint'}" status was updated to ${status.replace(/_/g, ' ')}.`;
      await supabase.from('cf_notifications').insert([{
        user_id: existing.citizen_id,
        title: `Status Update: ${status.replace(/_/g, ' ').toUpperCase()}`,
        message: statusMsg,
        link_url: `/complaint/${req.params.id}`
      }]);
      pushNtfy(existing.citizen_id, 'Status Update', statusMsg);
    } catch (_e) { /* non-fatal */ }
  }

  try {
    const { data: admins } = await supabase.from('cf_users').select('id').eq('role', 'admin');
    if (admins?.length) {
      const adminMsg = `"${existing.title || 'Complaint'}" status changed to ${status.replace(/_/g, ' ')}.`;
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
  } catch (_e) { /* non-fatal */ }

  return ok(res, 200, { complaint: data[0] }, 'Status updated');
}));

app.post('/api/v1/complaints/:id/withdraw', requireAuth, wrap(async (req, res) => {
  const { reason } = req.body || {};
  const { value: complaint } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, title, status, citizen_id')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!complaint) return fail(res, 404, 'Complaint not found');
  if (complaint.citizen_id !== req.user.id && req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  if (['closed', 'resolved', 'withdrawn'].includes(complaint.status)) {
    return fail(res, 400, 'Complaint already resolved/withdrawn');
  }

  const { data, error } = await supabase
    .from('cf_complaints')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select();
  if (error || !data?.length) return fail(res, 500, `Withdraw failed: ${error?.message || 'Unknown'}`);

  try {
    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      old_status: complaint.status,
      new_status: 'withdrawn',
      remarks: reason ? `Withdrawn: ${reason}` : 'Complaint withdrawn by citizen.'
    }]);
  } catch (_e) { /* non-fatal */ }

  return ok(res, 200, { complaint: data[0] }, 'Complaint withdrawn');
}));

app.post('/api/v1/complaints/:id/rating', requireAuth, wrap(async (req, res) => {
  const { rating_score, feedback } = req.body || {};
  if (!rating_score || rating_score < 1 || rating_score > 5) {
    return fail(res, 400, 'Rating score must be 1-5');
  }
  const { value: complaint } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, citizen_id, status')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!complaint) return fail(res, 404, 'Complaint not found');
  if (complaint.citizen_id !== req.user.id) return fail(res, 403, 'Only the reporting citizen can rate');
  if (!['resolved', 'closed'].includes(complaint.status)) {
    return fail(res, 400, 'Can only rate resolved/closed complaints');
  }
  const { data, error } = await supabase
    .from('cf_ratings')
    .insert([{
      complaint_id: req.params.id,
      citizen_id: req.user.id,
      rating_score,
      feedback: feedback || null
    }])
    .select('*');
  if (error || !data?.length) return fail(res, 500, `Rating failed: ${error?.message || 'Unknown'}`);
  return ok(res, 201, { rating: data[0] }, 'Rating submitted');
}));

app.delete('/api/v1/complaints/:id', requireAuth, wrap(async (req, res) => {
  const { value: complaint } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, title, status, citizen_id')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!complaint) return fail(res, 404, 'Complaint not found');
  if (req.user.role === 'citizen') {
    if (complaint.citizen_id !== req.user.id) return fail(res, 403, 'You can only delete your own complaints');
    if (complaint.status !== 'submitted') return fail(res, 400, 'Only submitted complaints can be deleted');
  }
  try {
    await supabase.from('cf_ratings').delete().eq('complaint_id', req.params.id);
  } catch (_e) { /* cascade */ }
  try {
    await supabase.from('cf_complaint_updates').delete().eq('complaint_id', req.params.id);
  } catch (_e) { /* cascade */ }
  try {
    await supabase.from('cf_notifications').delete().eq('link_url', `/complaint/${req.params.id}`);
  } catch (_e) { /* cascade */ }
  const { error } = await supabase.from('cf_complaints').delete().eq('id', req.params.id);
  if (error) return fail(res, 500, `Delete failed: ${error.message}`);
  return ok(res, 200, null, 'Complaint deleted');
}));

app.get('/api/v1/analytics/summary', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  const { data: complaints } = await supabase.from('cf_complaints').select('status, category, created_at');
  const { data: users } = await supabase.from('cf_users').select('id, role');
  const { data: departments } = await supabase.from('cf_departments').select('id');
  const total = complaints?.length || 0;
  const pending = ['submitted', 'under_review', 'assigned', 'in_progress'];
  const closed = ['resolved', 'closed'];
  const bad = ['rejected', 'withdrawn'];
  const pendingAction = complaints?.filter(c => pending.includes(c.status)).length || 0;
  const resolved = complaints?.filter(c => closed.includes(c.status)).length || 0;
  const rejected = complaints?.filter(c => bad.includes(c.status)).length || 0;
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
}));

app.get('/api/v1/analytics/complaints-by-category', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  const { data } = await supabase.from('cf_complaints').select('category');
  const counts = {};
  data?.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  const result = Object.entries(counts).map(([category, count]) => ({ category, count }));
  return ok(res, 200, { data: result }, 'Category breakdown fetched');
}));

app.get('/api/v1/analytics/department-performance', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Forbidden');
  const { data: depts } = await supabase.from('cf_departments').select('id, name, code');
  const { data: complaints } = await supabase.from('cf_complaints').select('department_id, status');
  const result = depts?.map(dept => {
    const dc = complaints?.filter(c => c.department_id === dept.id) || [];
    const closed = ['resolved', 'closed'];
    const terminal = ['resolved', 'closed', 'rejected', 'withdrawn'];
    return {
      department: dept.name,
      code: dept.code,
      total: dc.length,
      resolved: dc.filter(c => closed.includes(c.status)).length,
      pending: dc.filter(c => !terminal.includes(c.status)).length
    };
  });
  return ok(res, 200, { data: result }, 'Department performance fetched');
}));

app.get('/api/v1/worker/tasks', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'worker') return fail(res, 403, 'Forbidden');
  const { status } = req.query;
  let query = supabase
    .from('cf_complaints')
    .select(`*, cf_departments(name, code), ${CITIZEN_FK}`)
    .eq('assigned_worker_id', req.user.id);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { tasks: data || [] }, 'Worker tasks fetched');
}));

app.post('/api/v1/worker/tasks/:id/update', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'worker') return fail(res, 403, 'Forbidden');
  const { update_type, remarks, proof_image_url, geo_image_url, latitude, longitude } = req.body || {};
  if (!update_type || !remarks) return fail(res, 400, 'update_type and remarks are required');

  const { value: complaint } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, title, citizen_id, assigned_worker_id, status')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!complaint) return fail(res, 404, 'Task not found');
  if (complaint.assigned_worker_id !== req.user.id) return fail(res, 403, 'This task is not assigned to you');

  const { data, error } = await supabase
    .from('cf_worker_updates')
    .insert([{
      complaint_id: req.params.id,
      worker_id: req.user.id,
      update_type,
      remarks,
      proof_image_url: proof_image_url || null,
      geo_image_url: geo_image_url || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null
    }])
    .select('*');
  if (error || !data?.length) return fail(res, 500, `Update failed: ${error?.message || 'Unknown'}`);

  if (update_type === 'completed') {
    try {
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
    } catch (_e) { /* non-fatal */ }
  } else if (update_type === 'accepted' || update_type === 'in_progress') {
    try {
      const newStatus = 'in_progress';
      await supabase.from('cf_complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', req.params.id);
      await supabase.from('cf_complaint_updates').insert([{
        complaint_id: req.params.id,
        updated_by: req.user.id,
        old_status: complaint.status,
        new_status,
        remarks: `Worker update (${update_type}): ${remarks}`
      }]);
    } catch (_e) { /* non-fatal */ }
  }

  return ok(res, 201, { update: data[0] }, 'Worker update submitted');
}));

app.get('/api/v1/complaints/:id/worker-updates', requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('cf_worker_updates')
    .select('*, worker:cf_users!cf_worker_updates_worker_id_fkey(name, role)')
    .eq('complaint_id', req.params.id)
    .order('created_at', { ascending: true });
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { updates: data || [] }, 'Worker updates fetched');
}));

app.patch('/api/v1/complaints/:id/assign-worker', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { worker_id } = req.body || {};
  if (!worker_id) return fail(res, 400, 'worker_id is required');
  const { value: complaint } = safeFirst(
    await supabase
      .from('cf_complaints')
      .select('id, title, status')
      .eq('id', req.params.id)
      .limit(1)
  );
  if (!complaint) return fail(res, 404, 'Complaint not found');
  const TERMINAL_STATUSES = ['resolved', 'closed'];
  const newStatus = TERMINAL_STATUSES.includes(complaint.status) ? complaint.status : 'assigned';
  const { data, error } = await supabase
    .from('cf_complaints')
    .update({ assigned_worker_id: worker_id, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select();
  if (error || !data?.length) return fail(res, 500, `Assignment failed: ${error?.message || 'Unknown'}`);
  try {
    await supabase.from('cf_complaint_updates').insert([{
      complaint_id: req.params.id,
      updated_by: req.user.id,
      old_status: complaint.status,
      new_status,
      remarks: complaint.status === newStatus
        ? `Worker assigned (status preserved — already ${newStatus}).`
        : 'Worker assigned for dispatch.'
    }]);
    const assignMsg = `You have been assigned to: "${complaint.title}". Check your dashboard.`;
    await supabase.from('cf_notifications').insert([{
      user_id: worker_id,
      title: 'New Task Assigned',
      message: assignMsg,
      link_url: `/complaint/${req.params.id}`
    }]);
    pushNtfy(worker_id, 'New Task Assigned', assignMsg);
  } catch (_e) { /* non-fatal */ }
  return ok(res, 200, { complaint: data[0] }, 'Worker assigned');
}));

app.get('/api/v1/workers', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  let query = supabase
    .from('cf_users')
    .select('id, name, email, phone, department_id, active, created_at, cf_departments(name, code)')
    .eq('role', 'worker');
  if (req.user.role === 'officer' && req.user.department_id) {
    query = query.eq('department_id', req.user.department_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, { workers: data || [] }, 'Workers list fetched');
}));

app.patch('/api/v1/workers/:id', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { name, phone, department_id } = req.body || {};
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (department_id && req.user.role === 'admin') updates.department_id = department_id;
  if (Object.keys(updates).length === 0) return fail(res, 400, 'No fields to update');
  const { data, error } = await supabase
    .from('cf_users')
    .update(updates)
    .eq('id', req.params.id)
    .eq('role', 'worker')
    .select('*');
  if (error || !data?.length) return fail(res, 500, error?.message || 'Update failed');
  return ok(res, 200, { worker: data[0] }, 'Worker updated');
}));

app.patch('/api/v1/workers/:id/status', requireAuth, wrap(async (req, res) => {
  if (!['admin', 'officer'].includes(req.user.role)) return fail(res, 403, 'Forbidden');
  const { active } = req.body || {};
  const { data, error } = await supabase
    .from('cf_users')
    .update({ active: !!active })
    .eq('id', req.params.id)
    .eq('role', 'worker')
    .select('*');
  if (error || !data?.length) return fail(res, 500, error?.message || 'Update failed');
  return ok(res, 200, { worker: data[0] }, `Worker marked ${active ? 'active' : 'inactive'}`);
}));

app.delete('/api/v1/workers/:id', requireAuth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') return fail(res, 403, 'Only admins can delete workers');
  try {
    await supabase.from('cf_complaints').update({ assigned_worker_id: null }).eq('assigned_worker_id', req.params.id);
  } catch (_e) { /* cascade */ }
  const { error } = await supabase.from('cf_users').delete().eq('id', req.params.id).eq('role', 'worker');
  if (error) return fail(res, 500, error.message);
  return ok(res, 200, {}, 'Worker deleted');
}));

app.get('/api/v1/notifications', requireAuth, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('cf_notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return fail(res, 500, error.message);
  const unreadCount = (data || []).filter(n => !n.is_read).length;
  return ok(res, 200, { notifications: data || [], unreadCount }, 'Notifications fetched');
}));

app.get('/api/v1/notifications/ntfy-topics', requireAuth, (req, res) => {
  const topics = [];
  topics.push(`civicflow-citizen-${req.user.id}-${NTFY_SECRET}`);
  if (req.user.role === 'admin') topics.push(`civicflow-admin-${NTFY_SECRET}`);
  if (req.user.role === 'officer' && req.user.department_id) {
    topics.push(`civicflow-officer-${req.user.department_id}-${NTFY_SECRET}`);
  }
  if (req.user.role === 'worker' && req.user.department_id) {
    topics.push(`civicflow-worker-${req.user.department_id}-${NTFY_SECRET}`);
  }
  return ok(res, 200, { topics }, 'ntfy topics retrieved');
});

app.patch('/api/v1/notifications/read-all', requireAuth, wrap(async (req, res) => {
  await supabase.from('cf_notifications').update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
  return ok(res, 200, {}, 'All notifications marked read');
}));

app.patch('/api/v1/notifications/:id/read', requireAuth, wrap(async (req, res) => {
  await supabase.from('cf_notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
  return ok(res, 200, {}, 'Notification marked read');
}));

app.use('/api/*', (req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`));

app.use((req, res) => fail(res, 404, `Not found: ${req.method} ${req.originalUrl}`));

// FINAL GLOBAL JSON ERROR HANDLER (must be last)
// This ensures literally NO HTML error page is ever sent — every error is JSON.
app.use((err, req, res, _next) => {
  try {
    console.error('[API ERROR]', err?.stack || err?.message || err);
  } catch (_e) { /* nothing */ }
  if (res.headersSent) return;
  const status = Number(err?.statusCode || err?.status || 500) || 500;
  const message = err?.message && err.message !== 'Internal server error'
    ? err.message
    : 'Internal server error';
  res.status(status).json({ success: false, statusCode: status, message });
});

export default app;
