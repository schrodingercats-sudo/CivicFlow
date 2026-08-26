# CivicFlow — Full Codebase Audit Report

**Date:** August 26, 2026
**Auditor:** Independent Static Analysis (direct source code review)
**Scope:** Backend (Express), Frontend (React/Vite), Database Schema
**Methodology:** Line-by-line source code reading, API contract matching, security review, logic tracing

---

## Severity Legend

| Level | Meaning |
|-------|---------|
| 🔴 CRITICAL | Breaks core feature or critical security flaw |
| 🟠 HIGH | Significant bug, data loss risk, broken feature |
| 🟡 MEDIUM | Functional issue, inconsistency, or code smell |
| 🔵 LOW | Minor issue / UX polish |
| 🔒 SECURITY | Security vulnerability (may overlap with other levels) |

---

## SECTION 1 — SECURITY VULNERABILITIES

### BUG-S01 🔒 CRITICAL — No Password Authentication (Email-Only Login)

The entire authentication system accepts only an email address to log in. There is no password, PIN, OTP, or any other credential check. Anyone who knows or guesses any registered user's email can log in as that user — including `admin@civicflow.org`.

**Backend login flow** (`email` only, no other fields):
[auth.controller.js:64-90](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/auth.controller.js#L64-L90)
```js
export const login = async (req, res, next) => {
  const { email } = req.body;               // ← ONLY email accepted
  if (!email) throw new ApiError(400, ...);
  const { data: user } = await supabase
    .from('cf_users').select(...).eq('email', email).single();
  const token = generateToken(user);        // ← Token issued immediately
```

**Frontend login call** (passes email alone, no password field in UI):
[LoginPage.jsx:69-80](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/LoginPage.jsx#L69-L80)
```jsx
<input type="email" ... required />    // ← ONLY email field in form
// Demo login buttons also pass email only
```

[auth.service.js:4-12](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/auth.service.js#L4-L12)

---

### BUG-S02 🔒 CRITICAL — Any User Can Register as Admin (No RBAC on Register)

The register endpoint accepts the `role` field directly from the request body with **zero validation**. An attacker can POST `{"role": "admin"}` and create an admin account.

[auth.controller.js:16-62](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/auth.controller.js#L16-L62)
```js
const { name, email, phone, role = 'citizen', department_id } = req.body;
// ↑ role comes straight from request body — no check that caller is admin
// And then it's inserted directly:
role: role,
```

The frontend RegisterPage hardcodes `role: 'citizen'` (line 19), but anyone can hit the API directly with `role: 'admin'` via curl/Postman.

Additionally, the WorkerManagementPage uses this same unprotected `/auth/register` endpoint to create workers — which means `WorkerManagementPage` works for anyone, not just admins/officers.

[WorkerManagementPage.jsx:73-76](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerManagementPage.jsx#L73-L76)
```js
await apiRequest('/auth/register', {
  method: 'POST',
  body: JSON.stringify({ ...addForm, role: 'worker' })  // ← unguarded
});
```

---

### BUG-S03 🔒 CRITICAL — Secrets Hardcoded in Source Code (JWT, Supabase, NTFY)

Multiple secrets are hardcoded with `||` fallbacks directly in source files. These values are committed to git.

**Supabase URL + Anon Key** (full anon key in source):
[supabase.js:6-7](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/config/supabase.js#L6-L7)
```js
const supabaseUrl = process.env.SUPABASE_URL || 'https://enrrsnbfushieufmqmuq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJ...<FULL_KEY_HERE>';
```

**JWT Secret** (used for signing + verifying tokens):
[auth.controller.js:6](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/auth.controller.js#L6)
[auth.middleware.js:16](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/middleware/auth.middleware.js#L16)
```js
const JWT_SECRET = process.env.JWT_SECRET || 'civicflow-super-secret-jwt-key-2026';
```
Anyone with this secret can forge JWTs for any user.

**NTFY Topic Secret** (exposes all notification streams):
[ntfy.service.js:6-8](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/services/ntfy.service.js#L6-L8)
```js
admin: `civicflow-admin-${process.env.NTFY_SECRET || 'x9k2m7p4'}`,
```

---

### BUG-S04 🔒 HIGH — CORS Wildcard Accepts Every Origin

[app.js:16](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/app.js#L16)
```js
app.use(cors());  // ← no origin restriction
```

Any website can make authenticated cross-origin API calls using a victim's stored token.

---

### BUG-S05 🔒 HIGH — Departments Endpoint Has No Authentication

The `/api/v1/departments` route is completely unprotected. No auth middleware at all.

[department.routes.js:1-8](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/routes/department.routes.js#L1-L8)
```js
const router = Router();
router.get('/', getDepartments);   // ← NO authenticate, NO authorize
```

Anyone can query the departments list. Not critical alone but adds to attack surface.

---

### BUG-S06 🔒 MEDIUM — JWT Tokens Cannot Be Revoked (Logout is Client-Only)

Logout only removes the token from localStorage:
[auth.service.js:37-39](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/auth.service.js#L37-L39)

The server-side JWT remains valid for 7 days:
[auth.controller.js:8-14](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/auth.controller.js#L8-L14)
```js
{ expiresIn: '7d' }
```

A stolen JWT is usable for a full week with no way to revoke it. There is also no refresh token / token rotation.

---

### BUG-S07 🔒 MEDIUM — No Rate Limiting on Auth Endpoints

[auth.routes.js:7-8](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/routes/auth.routes.js#L7-L8)
```js
router.post('/register', register);    // ← no rate limit
router.post('/login', login);          // ← no rate limit
```

An attacker can:
- Spam register to flood the database
- Brute-force email guessing on login (combined with BUG-S01, this gives full access)

---

### BUG-S08 🔒 MEDIUM — `cf_users.active` Flag Never Checked in Auth

The schema (and live DB) has an `active` boolean column. WorkerManagementPage has a toggle-status button that sets `active: false`. But the authentication middleware never filters for `active = true`:

[auth.middleware.js:21-29](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/middleware/auth.middleware.js#L21-L29)
```js
.from('cf_users')
.select('*, cf_departments(name, code)')
.eq('id', decoded.id)
// ← Missing: .eq('active', true)
.single();
```

Deactivated users can continue to log in and use the system. The `active` column is dead code.

---

## SECTION 2 — MISSING BACKEND ENDPOINTS (404 at Runtime)

The following frontend API calls have **no matching route in `backend/src/routes/`**. Each returns a 404 in local development.

### BUG-M01 🔴 CRITICAL — All Worker Routes Missing

| Frontend Call | File | Status |
|---|---|---|
| `GET /api/v1/workers` | [complaint.service.js:61-63](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/complaint.service.js#L61-L63) | ❌ No route |
| `GET /api/v1/worker/tasks` | [WorkerDashboard.jsx:51](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerDashboard.jsx#L51) | ❌ No route |
| `POST /api/v1/worker/tasks/:id/update` | [WorkerDashboard.jsx:73-82](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerDashboard.jsx#L73-L82) | ❌ No route |
| `PATCH /api/v1/workers/:id` | [WorkerManagementPage.jsx:101-107](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerManagementPage.jsx#L101-L107) | ❌ No route |
| `PATCH /api/v1/workers/:id/status` | [WorkerManagementPage.jsx:122-125](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerManagementPage.jsx#L122-L125) | ❌ No route |
| `DELETE /api/v1/workers/:id` | [WorkerManagementPage.jsx:138](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerManagementPage.jsx#L138) | ❌ No route |

Only 6 route files exist — there is no `workers.routes.js`.

---

### BUG-M02 🔴 CRITICAL — Worker Assignment + Worker-Update Endpoints Missing

| Frontend Call | File | Status |
|---|---|---|
| `PATCH /complaints/:id/assign-worker` | [complaint.service.js:54-59](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/complaint.service.js#L54-L59) | ❌ No route |
| `GET /complaints/:id/worker-updates` | [complaint.service.js:65-67](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/complaint.service.js#L65-L67) | ❌ No route |

OfficerDashboard's "Dispatch Worker to Site" button calls the first one — currently returns 404.

---

### BUG-M03 🟠 HIGH — Complaint Status Update Endpoint Mismatch

**Frontend** calls with `/status` suffix:
[complaint.service.js:20-25](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/complaint.service.js#L20-L25)
```js
return await apiRequest(`/complaints/${id}/status`, { method: 'PATCH', ... });
```

**Backend** defines it at root without suffix:
[complaint.routes.js:22](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/routes/complaint.routes.js#L22)
```js
router.patch('/:id', authorize('officer', 'admin'), updateComplaintStatus);
```

Result: **404 on local dev** every time an officer or admin tries to update status.

---

### BUG-M04 🟠 HIGH — Analytics Endpoint Mismatch (Local Backend Only)

**Frontend** calls:
[complaint.service.js:45-47](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/complaint.service.js#L45-L47)
```js
return await apiRequest('/analytics/summary');
```

**Backend** defines only:
[analytics.routes.js:8](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/routes/analytics.routes.js#L8)
```js
router.get('/stats', authenticate, authorize('admin'), getAdminStats);
```

AdminDashboard → empty stats (404) in local development.

---

## SECTION 3 — BACKEND LOGIC BUGS

### BUG-L01 🔴 CRITICAL — Officers Can View *Any* Complaint From Any Department

`getComplaintById` only restricts citizens — no restriction for officers:

[complaint.controller.js:159-161](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L159-L161)
```js
if (req.user.role === 'citizen' && complaint.citizen_id !== req.user.id) {
  throw new ApiError(403, ...);
}
// ← Officer/admin branch: NO dept check — officer from Roads dept can read Traffic dept complaints
```

An officer from department A can access complaints from department B.

---

### BUG-L02 🟠 HIGH — Officer List Filter Ignores `assigned_officer_id`

When an officer has both a `department_id` AND is assigned directly via `assigned_officer_id`, they **only** see department-scope complaints, not the ones directly assigned to them:

[complaint.controller.js:115-120](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L115-L120)
```js
} else if (req.user.role === 'officer') {
  if (req.user.department_id) {
    query = query.eq('department_id', req.user.department_id); // ← If dept exists, this wins
  } else {
    query = query.eq('assigned_officer_id', req.user.id);       // ← Only used if no dept
  }
}
```

Expected logic: officer should see **both** department complaints AND individually-assigned complaints (union). The current code makes it an `if/else`, not an `OR`.

---

### BUG-L03 🟠 HIGH — Withdraw Status Override Logic Bug

This condition in `updateComplaintStatus`:

[complaint.controller.js:210-212](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L210-L212)
```js
if ((existingComplaint.status === 'rejected' || existingComplaint.status === 'withdrawn')
    && (!status || status === existingComplaint.status)) {
  status = 'submitted';
}
```

Problem scenario: `existingComplaint.status === 'withdrawn'` AND the caller explicitly passes `status: 'withdrawn'` (e.g. officer tries to re-withdraw or update remarks). The condition `status === existingComplaint.status` is TRUE → status gets **silently changed to 'submitted'**. The complaint re-opens when the caller meant to keep it withdrawn.

---

### BUG-L04 🟠 HIGH — Fire-and-Forget AI Processing Has No Unhandled Rejection Guard

[complaint.controller.js:83](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L83)
```js
processComplaintAsync(complaint.id, title, description);
// ↑ No await, no .catch() wrapping
```

The function does have an internal try/catch, but if that catch block itself throws (e.g. the logger or the `.update()` error handler fails), an unhandled promise rejection propagates up. In strict Node environments this will terminate the process.

Fix: `processComplaintAsync(...).catch(err => logger.error('top-level AI failure:', err))`

---

### BUG-L05 🟠 HIGH — Complaint Delete Uses `link_url LIKE /complaint/{id}` to Find Notifications

Fragile matching — if any notification exists for a DIFFERENT complaint whose URL is a substring match, it would be deleted too.

[complaint.controller.js:417](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L417)
```js
await supabase.from('cf_notifications').delete().eq('link_url', `/complaint/${id}`);
```

This happens to work with exact match (`eq`) so substring won't match. But if the link ever uses query params or a different format, this silently leaves orphan notifications or deletes the wrong ones. Should have a `complaint_id` FK column on `cf_notifications`.

---

### BUG-L06 🟡 MEDIUM — Analytics Controller Fetches ALL Complaints, ALL Users, ALL Depts (No Pagination/Aggregation)

[analytics.controller.js:7-16](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/analytics.controller.js#L7-L16)
```js
.from('cf_complaints').select('id, status, category, priority, created_at, department_id');
// ↑ No limit, no range — returns every complaint ever
const { data: users } = await supabase.from('cf_users').select('id, role');
// ↑ Every user in the system just to get counts
```

Scales O(n) — will collapse under any real volume. Should use Supabase `.count('exact')` or PostgreSQL `GROUP BY`.

---

### BUG-L07 🟡 MEDIUM — `withdrawn` Status Not in Allowed Set for Several Frontend Buttons

ComplaintDetailPage only permits rating when status is `resolved` or `closed`:
[ComplaintDetailPage.jsx:212](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/ComplaintDetailPage.jsx#L212)
```jsx
{(complaint.status === 'resolved' || complaint.status === 'closed') && (
```
Good — correct check. But the backend `withdrawComplaint` already allows admin to withdraw resolved/closed complaints:

[complaint.controller.js:301](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L301)
```js
if (complaint.status === 'closed' || complaint.status === 'resolved' || complaint.status === 'withdrawn') {
  throw new ApiError(400, 'Complaint is already resolved, closed, or withdrawn');
}
```
OK — withdraw blocks those. Good.

BUT `rateComplaint` blocks resolved+closed only. A complaint that was rejected can never be rated (fine). A complaint that was withdrawn can never be rated (correct). So this is fine actually — marking as observed, no bug.

---

## SECTION 4 — SCHEMA / DATABASE (schema.sql vs Code Mismatch)

Each bug below means schema.sql is out of sync with what the code expects. If you create a new DB from schema.sql, these features break.

### BUG-D01 🔴 CRITICAL — `worker` Missing from cf_user_role Enum

[schema.sql:9-11](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql#L9-L11)
```sql
CREATE TYPE cf_user_role AS ENUM ('citizen', 'officer', 'admin');
-- 'worker' IS MISSING
```

All worker registration and role queries fail on a fresh database created from this file. Code references `role='worker'` everywhere:
- [App.jsx:53](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/App.jsx#L53),
- [WorkerManagementPage.jsx:75](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerManagementPage.jsx#L75)

---

### BUG-D02 🔴 CRITICAL — `withdrawn` Missing from cf_complaint_status Enum

[schema.sql:29-39](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql#L29-L39)
```sql
CREATE TYPE cf_complaint_status AS ENUM (
  'submitted', 'under_review', 'assigned', 'in_progress',
  'resolved', 'closed', 'rejected'
  -- 'withdrawn' IS MISSING
);
```

Used in code at [complaint.controller.js:282-336](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js#L282-L336) (withdrawComplaint), [CitizenDashboard.jsx:69](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/CitizenDashboard.jsx#L69) filter, etc. All writes fail with enum violation.

---

### BUG-D03 🟠 HIGH — `assigned_worker_id` Column Missing from cf_complaints

[schema.sql:106-108](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql#L106-L108) — only `assigned_officer_id` exists:
```sql
assigned_officer_id UUID REFERENCES public.cf_users(id) ON DELETE SET NULL,
assigned_worker_id UUID  -- ← this line is MISSING
```

But WorkerDashboard queries it and complaint.service.js assigns it.

---

### BUG-D04 🟠 HIGH — `geo_image_url` Column Missing from cf_complaints

SubmitComplaintPage sends `geo_image_url`:
[SubmitComplaintPage.jsx:127](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/SubmitComplaintPage.jsx#L127)
```js
geo_image_url: geoImageUrl || null
```

Schema has no `geo_image_url` column in cf_complaints (only `image_url`). The value is silently lost or the insert fails depending on strictness.

---

### BUG-D05 🟠 HIGH — `cf_worker_updates` Table Not Defined

[schema.sql](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql) — no cf_worker_updates table.
Code references this table in:
- [WorkerDashboard.jsx:73](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerDashboard.jsx#L73) — `/worker/tasks/:id/update` would insert here
- complaint.service.js `getWorkerUpdates`

---

### BUG-D06 🟡 MEDIUM — `cf_users.active` Column Not Defined in schema.sql

WorkerManagementPage toggles active status, schema has no `active` column in cf_users definition. BUG-S08 covers the auth-side problem; this is the schema-side missing definition.

---

## SECTION 5 — FRONTEND BUGS

### BUG-F01 🔴 CRITICAL — AdminDashboard Departments Always Empty (Response Shape Misread)

AdminDashboard loads departments like this:

[AdminDashboard.jsx:32-36](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/AdminDashboard.jsx#L32-L36)
```js
const [statsRes, complaintsRes, deptsRes] = await Promise.all([
  complaintService.getAdminStats(),
  complaintService.getComplaints({ limit: 50 }),
  complaintService.getDepartments()        // ← returns array of depts
]);
...
setDepartments(Array.isArray(deptsRes) ? deptsRes : deptsRes?.departments || []);
```

Wait — actually line 36 does handle both shapes (`Array.isArray` check). OK — this is fine. But let me check the OTHER places it reads the API response:

[AdminDashboard.jsx:88-91](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/AdminDashboard.jsx#L88-L91)
```js
const departmentStats = (departments || []).map(dept => {
  const dc = complaints.filter(c => c.department_id === dept.id);
```

Actually this works because line 36 handles both shapes. Good. But:

---

### BUG-F02 🟠 HIGH — AdminDashboard Stats Field Names Mismatch (camelCase vs snake_case)

Backend `getAdminStats` returns camelCase:
[analytics.controller.js:48-57](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/analytics.controller.js#L48-L57)
```js
summary: {
  totalComplaints,      // ← camelCase
  submitted,
  inProgress,
  resolved,
  rejected,
  resolutionRate,
  totalUsers,
  totalOfficers,
  totalDepartments
}
```

Frontend reads snake_case:
[AdminDashboard.jsx:82-85](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/AdminDashboard.jsx#L82-L85)
```js
const totalComplaintsCount = stats?.total_complaints ?? complaints.length;  // ← snake
const pendingCount = stats?.pending_action ?? ...;                          // ← snake
const resolvedCount = stats?.resolved_closed ?? ...;                        // ← snake
const criticalCount = stats?.critical_escalations ?? ...;                   // ← snake
```

All four fall back to client-side counting (which works, but defeats the purpose of the API and causes inconsistency). The `??` fallback saves this from being a display bug, but the API's returned stats are **never used**.

---

### BUG-F03 🟠 HIGH — OfficerDashboard Workers Response Always Empty (Unless API returns `{workers:[...]}`)

[OfficerDashboard.jsx:60-67](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/OfficerDashboard.jsx#L60-L67)
```js
const res = await complaintService.getWorkers();
setWorkers(res.workers || []);   // ← reads .workers key
```

`complaintService.getWorkers()` calls `/workers` which doesn't exist (BUG-M01). If it did exist and returned a raw array, `res.workers` would be undefined and `[]` is used. Combined with the missing endpoint, workers dropdown is always empty.

---

### BUG-F04 🟠 HIGH — WorkerDashboard Uses Non-DB Status Values (accepted / en_route / on_site)

WorkerDashboard filters and update-type dropdown use statuses that are **not** in `cf_complaint_status` enum:

[WorkerDashboard.jsx:60-65](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerDashboard.jsx#L60-L65)
```js
if (filter === 'Active') return ['accepted', 'en_route', 'on_site', 'in_progress'].includes(task.status);
```

[WorkerDashboard.jsx:260-266](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/WorkerDashboard.jsx#L260-L266)
```html
<option value="accepted">Task Accepted</option>
<option value="en_route">En Route to Site</option>
<option value="on_site">Arrived On Site</option>
```

These statuses are not in `cf_complaint_status`. Storing them would fail with an enum constraint error. Worker updates are meant to go to a separate `cf_worker_updates.update_type` column (which is `TEXT` per schema, so fine there), but the `task.status` comparison will ALWAYS match zero records because complaints never have status='accepted' etc.

Worker Dashboard filter tabs "New / Active / Completed" show empty results permanently.

---

### BUG-F05 🟡 MEDIUM — PageLoader `spin` Animation Keyframe Not Defined

[App.jsx:20-25](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/App.jsx#L20-L25)
```jsx
<div style={{
  ... ,
  animation: 'spin 0.8s linear infinite',  // ← 'spin' keyframe doesn't exist
}} />
```

The spinner renders as a static circle. No `@keyframes spin` in index.css or anywhere.

---

### BUG-F06 🟡 MEDIUM — Cache Too Aggressively Cleared (Everything on Every Mutation)

[api.js:35-42](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/api.js#L35-L42)
```js
if (method !== 'GET') {
  const STABLE_KEYS = ['/departments'];
  for (const key of cache.keys()) {
    if (!STABLE_KEYS.some(s => key.startsWith(s))) {
      cache.delete(key);    // ← clears workers, analytics, EVERYTHING on submit/like/etc
    }
  }
}
```

Departments are preserved — good. But `/workers` (rarely changes), `/analytics/summary` (changes on status update only), and similar are blown away on a notification mark-as-read. Unnecessary refetch churn.

---

### BUG-F07 🟡 MEDIUM — Citizen Dashboard "In Progress" Metric Omits 'under_review' and 'assigned'

[CitizenDashboard.jsx:67](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/CitizenDashboard.jsx#L67)
```js
const inProgressCount = complaints.filter(c =>
  c.status === 'in_progress' || c.status === 'submitted' || c.status === 'assigned'
).length;
```

Missing `'under_review'`. An officer can set status to 'under_review' which the citizen will see in the list but NOT in the counter. The "Active / Pending" card count doesn't match visible tab counts. Officer Dashboard correctly includes these; Citizen does not.

---

### BUG-F08 🟡 MEDIUM — ComplaintStatus Update in OfficerDashboard Ignores Worker Assignment Inside the Modal

OfficerDashboard's "Update Status" modal has both a "Update Status" submit and a separate "Dispatch Worker" button:

[OfficerDashboard.jsx:397-406](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/OfficerDashboard.jsx#L397-L406)
```jsx
<button
  onClick={handleAssignWorker}
  ...
  {assigning ? 'Dispatching...' : 'Dispatch Worker to Site'}
</button>
```

`handleAssignWorker` calls `/complaints/:id/assign-worker` which doesn't exist (BUG-M02). So dispatch is broken. But ALSO: if a user assigns a worker AND then changes status, the two actions happen independently with no atomicity — partial failure leaves complaint in inconsistent state.

---

## SECTION 6 — DEPLOYMENT / CONFIGURATION

### BUG-C01 🟠 HIGH — Two Backend Implementations Noted in Directory

Directory listing shows:
- `backend/src/` — full modular Express app (used locally)
- `api/index.js` — single-file Vercel serverless (used in prod)

The frontend `complaint.service.js` status endpoint uses `/status` suffix matching the serverless file. This confirms the **local backend is NOT what's used in production**. All endpoint mismatches (BUG-M01~M04) are because developers ran the local backend which has diverged from what Vercel serves.

This is not a runtime bug per se, but it means there are two truth sources for routes. Changes to `backend/src/routes/*.js` do NOT affect the deployed site — must also mirror them to `api/index.js`.

---

### BUG-C02 🟠 HIGH — Vercel Functions 10s Timeout Too Low for AI Processing

[vercel.json](file:///c:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/vercel.json) (if it contains):
```json
{ "functions": { "api/index.js": { "maxDuration": 10 } } }
```
(Common default configuration.) Groq/NVIDIA API calls can take 3-8s alone; combined with DB inserts and ntfy push, submit flows >10s timeout. If AI triage is later added to `api/index.js`, need 30s.

---

### BUG-C03 🟡 MEDIUM — SUPABASE_SERVICE_ROLE_KEY Referenced in .env.example But Unused

The backend connects with the **anon key** (BUG-S03 shows `SUPABASE_ANON_KEY` is the fallback). If RLS policies exist, admin-level operations (bulk notifications insert, stats queries across all users) would silently return empty or filtered data. All backend operations are constrained by the anon key's RLS — the service role key is never read anywhere.

---

## SECTION 7 — SUMMARY TABLE

| ID | Sev | Category | Title |
|---|---|---|---|
| BUG-S01 | 🔒🔴 CRITICAL | Security | Email-only login — no password/OTP |
| BUG-S02 | 🔒🔴 CRITICAL | Security | Anyone can register with role='admin' |
| BUG-S03 | 🔒🔴 CRITICAL | Security | JWT/Supabase/NTFY secrets hardcoded in source |
| BUG-S04 | 🔒🟠 HIGH | Security | CORS wildcard (all origins) |
| BUG-S05 | 🔒🟠 HIGH | Security | /departments public unauthenticated |
| BUG-S06 | 🔒🟡 MEDIUM | Security | JWT not revocable, 7-day lifespan |
| BUG-S07 | 🔒🟡 MEDIUM | Security | No rate limit on auth endpoints |
| BUG-S08 | 🔒🟡 MEDIUM | Security | active=true not checked during auth |
| BUG-M01 | 🔴 CRITICAL | Missing Routes | All /workers + /worker/* endpoints missing |
| BUG-M02 | 🔴 CRITICAL | Missing Routes | assign-worker + worker-updates endpoints missing |
| BUG-M03 | 🟠 HIGH | Missing Routes | Status update path mismatch /:id vs /:id/status |
| BUG-M04 | 🟠 HIGH | Missing Routes | Analytics /summary vs /stats mismatch |
| BUG-L01 | 🔴 CRITICAL | Backend Logic | Officers can view any complaint (no dept check) |
| BUG-L02 | 🟠 HIGH | Backend Logic | Officer query ignores assigned_officer_id when dept exists |
| BUG-L03 | 🟠 HIGH | Backend Logic | withdrawn → submitted override bug in updateComplaintStatus |
| BUG-L04 | 🟠 HIGH | Backend Logic | processComplaintAsync unhandled rejection risk |
| BUG-L05 | 🟠 HIGH | Backend Logic | Notification delete on complaint removal uses link_url not FK |
| BUG-L06 | 🟡 MEDIUM | Backend Logic | Analytics fetches ALL rows client-side |
| BUG-D01 | 🔴 CRITICAL | Schema | cf_user_role missing 'worker' value |
| BUG-D02 | 🔴 CRITICAL | Schema | cf_complaint_status missing 'withdrawn' value |
| BUG-D03 | 🟠 HIGH | Schema | cf_complaints missing assigned_worker_id column |
| BUG-D04 | 🟠 HIGH | Schema | cf_complaints missing geo_image_url column |
| BUG-D05 | 🟠 HIGH | Schema | cf_worker_updates table not defined |
| BUG-D06 | 🟡 MEDIUM | Schema | cf_users.active column not defined |
| BUG-F02 | 🟠 HIGH | Frontend | Admin stats snake_case reads unused (camelCase API) |
| BUG-F03 | 🟠 HIGH | Frontend | Officer worker list always empty + endpoint 404 |
| BUG-F04 | 🟠 HIGH | Frontend | Worker statuses accepted/en_route aren't in DB enum |
| BUG-F05 | 🟡 MEDIUM | Frontend | Spinner animation keyframe undefined |
| BUG-F06 | 🟡 MEDIUM | Frontend | Cache cleared too aggressively |
| BUG-F07 | 🟡 MEDIUM | Frontend | Citizen in-progress metric misses 'under_review' |
| BUG-F08 | 🟡 MEDIUM | Frontend | Worker dispatch fails (missing endpoint) |
| BUG-C01 | 🟠 HIGH | Config | Dual backends (local + serverless) diverged |
| BUG-C02 | 🟠 HIGH | Config | Vercel 10s timeout too low for AI |
| BUG-C03 | 🟡 MEDIUM | Config | Service role key unused — all ops under anon key RLS |

---

## PRIORITY FIX ORDER

### P0 — IMMEDIATE (Data leaks / account takeover)
1. **BUG-S01** — Add real authentication (password/OTP). Email-only login is a full takeover risk.
2. **BUG-S02** — Register endpoint must restrict `role`. Only admin can create officer/admin/worker accounts.
3. **BUG-S03** — Rotate ALL secrets (Supabase anon key, JWT secret, NTFY secret). Remove `||` fallbacks. Throw if env vars missing.
4. **BUG-L01** — Officers must not read other departments' complaints.

### P1 — THIS WEEK (Broken core features)
5. **BUG-M01/M02** — Add worker routes (GET/PATCH/DELETE /workers, GET/POST /worker/tasks/:id/update, PATCH /complaints/:id/assign-worker, GET /complaints/:id/worker-updates)
6. **BUG-M03** — Align status update path (either add `/status` suffix to backend or remove it from frontend)
7. **BUG-M04** — Align analytics route path
8. **BUG-D01/D02** — Fix DB enums (add 'worker' role, add 'withdrawn' status)
9. **BUG-D03/D04/D05** — Add assigned_worker_id, geo_image_url columns and cf_worker_updates table to schema.sql
10. **BUG-F04** — Map worker update types correctly (use cf_worker_updates table, don't put them in complaint.status)

### P2 — THIS SPRINT (Quality + Security hardening)
11. BUG-S04 (CORS origin whitelist)
12. BUG-S06 (JWT revocation / refresh tokens)
13. BUG-S07 (Rate limit on auth)
14. BUG-S08 (Check active=true on login)
15. BUG-L02 (Officer query OR instead of if/else)
16. BUG-L03 (Withdrawn status override fix)
17. BUG-F02 (Rename API fields to match frontend or vice-versa)
18. BUG-F05 (Add spin keyframe)
19. BUG-F07 (CitizenDashboard in-progress includes under_review)

---

*Audit completed August 26, 2026 — Source-only static review of backend/src, frontend/src, and database/schema.sql files.*
