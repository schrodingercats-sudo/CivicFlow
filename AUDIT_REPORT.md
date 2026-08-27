# CivicFlow Codebase Audit Report

**Audit date:** August 27, 2026

**Scope:** React frontend, Express backend, Vercel serverless API, and database schema
**Method:** Static source review, deployment-route/contract tracing, JavaScript syntax checks, and a production frontend build.

## Executive summary

The application has one immediately exploitable critical issue: authentication is based solely on a known email address. An attacker can therefore log in as any existing citizen, officer, worker, or administrator. The Vercel API, which is the configured production API entry point, also contains a deterministic fallback JWT signing secret and multiple missing authorization-scope checks. These should be fixed before exposing the system to real users or civic data.

## Findings

### CF-01 — Critical security: email address is the only login credential

**Evidence:** [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:137) reads only `email`, fetches that user, and immediately generates a JWT. The frontend intentionally submits only `{ email }` in [auth.service.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/auth.service.js:4). The local Express backend implements the same pattern in [auth.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/auth.controller.js:86).

**Impact:** Anyone who knows or guesses a registered email can obtain that account's token, including an administrator token, then read or alter complaints and manage workers.

**Recommended fix:** Replace this scheme with Supabase Auth or another server-side authentication provider. Require a verified password or email OTP before issuing an application session, and link `cf_users.auth_id` to the authenticated subject. Do not accept an email address as proof of identity.

### CF-02 — High security: production API falls back to a public JWT secret

**Evidence:** [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:51) uses the literal fallback `civicflow-dev-secret-change-me`. [vercel.json](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/vercel.json:8) deploys this file as the API function.

**Impact:** If `JWT_SECRET` is omitted or misconfigured in Vercel, anyone can sign valid seven-day tokens using the committed secret. The request middleware then loads the referenced user and trusts the token.

**Recommended fix:** Fail application startup/function initialization when `JWT_SECRET`, `SUPABASE_URL`, or the required Supabase key is absent. Remove all production credential defaults and rotate the JWT secret after deployment.

### CF-03 — High security: officers can update or dispatch any complaint

**Evidence:** The production status mutation permits any authenticated `officer` in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:384), loads the complaint without checking its department, and updates it. The worker-assignment route has the same role-only check in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:697). The local backend has the same defect in [complaint.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js:199) and [complaint.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js:462).

**Impact:** An officer who obtains another complaint UUID can change its status, reassign its department, or dispatch a worker across departmental boundaries.

**Recommended fix:** Before either mutation, allow an officer only when the complaint belongs to `req.user.department_id` or is explicitly assigned to that officer. Enforce the same condition in the database with Row Level Security where possible.

### CF-04 — High security: officers can edit or deactivate workers outside their department

**Evidence:** Worker listing is scoped to an officer's department in [worker.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/worker.controller.js:14), but `updateWorker` and `toggleWorkerStatus` update a worker by ID with no departmental predicate in [worker.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/worker.controller.js:32) and [worker.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/worker.controller.js:62). The deployed Vercel counterparts repeat this in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:753) and [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:771).

**Impact:** Any officer who learns another worker's UUID can modify their phone/name or deactivate them, even if that worker belongs to another department.

**Recommended fix:** Fetch the target worker first and require `target.department_id === req.user.department_id` for officers. Add `department_id` as an update predicate as defense in depth.

### CF-05 — High: worker assignment accepts any user and ignores department/active state

**Evidence:** Both implementations set `assigned_worker_id` directly from the request without verifying that it identifies an active `worker` in the complaint's department: [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:697) and [complaint.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js:462). The database foreign key only proves the ID is a user; it does not enforce role or department ([schema.sql](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql:87)).

**Impact:** A complaint can be assigned to a citizen, administrator, inactive worker, or worker from another department. It is then marked `assigned`, but the intended worker queue may never show it.

**Recommended fix:** Query the candidate with `id`, `role`, `active`, and `department_id`; require `role === 'worker'`, `active === true`, and a department matching the complaint before updating. Reject terminal complaints instead of preserving a resolved/closed status with a new worker assignment.

### CF-06 — Medium security/privacy: any logged-in user can read field-worker updates for any complaint ID

**Evidence:** The worker-update endpoint directly selects by complaint ID with no preceding ownership or role scope check in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:687) and [complaint.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js:530). Worker updates can include field proof images, geotagged images, latitude, and longitude ([schema.sql](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql:128)).

**Impact:** Any authenticated account can enumerate complaint UUIDs it learns and access operational updates and precise field-location evidence outside its authorized cases.

**Recommended fix:** Reuse the complaint-detail authorization check before returning updates: citizen owner, assigned worker, owning/assigned officer, or admin only.

### CF-07 — Medium: local backend and deployed API have divergent profile routes

**Evidence:** The frontend updates profiles through `PUT /auth/me` in [auth.service.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/services/auth.service.js:30). The local backend registers `PUT /api/v1/auth/me` in [auth.routes.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/routes/auth.routes.js:12), whereas the production Vercel function exposes only `PUT /api/v1/auth/profile` in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:196).

**Impact:** Profile saving succeeds locally but returns 404 after deployment. This is easy to miss because Vercel bypasses the modular `backend/src` application entirely.

**Recommended fix:** Make the Vercel function import and run the modular backend app, or remove the duplicate implementation. Keep one API contract and add an integration test that runs against the actual deployment entry point.

### CF-08 — Medium: complaint creation silently converts invalid/missing GPS coordinates to `0,0`

**Evidence:** The frontend coerces invalid coordinates to zero in [SubmitComplaintPage.jsx](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/frontend/src/pages/SubmitComplaintPage.jsx:160). The production API repeats that coercion in [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:309), while the schema permits the resulting numeric values ([schema.sql](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/database/schema.sql:66)).

**Impact:** A failed geolocation request creates a seemingly valid complaint pinned near the Gulf of Guinea instead of informing the citizen. Dispatch and analytics become unreliable.

**Recommended fix:** Require finite latitude/longitude values and validate geographic ranges (`-90..90`, `-180..180`) on the API. Disable submission until the user supplies a valid location or intentionally selects one on the map.

### CF-09 — Medium: status changes and audit/notification records are not atomic

**Evidence:** Complaint status is updated first and the timeline/notification writes happen afterward in [complaint.controller.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/backend/src/controllers/complaint.controller.js:239) and [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:401). The Vercel version suppresses several follow-up failures with empty catch blocks, for example [api/index.js](C:/Users/prath/OneDrive/Desktop/SKY/CivicFlow/api/index.js:412).

**Impact:** The response can report success while an audit entry or notification is missing. In a civic workflow, this makes the displayed history and accountability trail unreliable.

**Recommended fix:** Move the state change and required audit insert into a Supabase Postgres RPC/transaction. Treat notifications as an outbox/background concern with retry and observable failures; never silently discard audit-write errors.

## Validation performed

- `node --check api/index.js` — passed.
- `node --check backend/src/app.js` — passed.
- `npm --prefix frontend run build` — passed. Vite emitted a non-blocking warning that the Tailwind `content` option is missing/empty and a bundle-size warning (main JS ~615 kB uncompressed).
- No automated unit, authorization, or API integration tests are configured in the reviewed `package.json` files.

## Remediation order

1. Replace email-only authentication and invalidate all existing application JWTs.
2. Remove the JWT fallback and configure required production environment variables.
3. Add ownership/department checks to every complaint and worker mutation, plus worker-assignment validation.
4. Consolidate the duplicate APIs, then add integration tests for production routes and cross-department access attempts.
5. Add coordinate validation and transaction/outbox handling for complaint state changes.
