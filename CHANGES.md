# BugBoard — สรุปการแก้ไข (Code Review Remediation)

> วันที่: 2026-07-10 · ขอบเขต: **HIGH + MEDIUM findings** (ไม่แตะ `docker-compose.yml` ตามที่ตกลง)
> อ้างอิงรายงานรีวิวเต็ม: `implementation_plan.md` และไฟล์แผนใน `~/.claude/plans/`

## ภาพรวม

แก้ไฟล์ที่มีอยู่ **11 ไฟล์** + เพิ่มไฟล์ใหม่ **8 ไฟล์** (รวม e2e) ครอบคลุม 3 HIGH (H1, H2) + 7 MEDIUM (M1–M7) และ LOW ที่จำเป็นต่อกัน (L2, L3)
> หมายเหตุ: **H3 (docker MySQL root/รหัสอ่อน)** เลื่อนตามคำขอ — เป็น known risk, ห้าม deploy นอก localhost จนกว่าจะแก้

| Batch | Finding | ไฟล์หลัก |
|-------|---------|----------|
| 1 | H1 SSE resync, M3 updatedAt reconcile | `hooks/useIssueStream.ts`, `hooks/useIssues.ts` |
| 2 | H2 seed/login credentials | `app/login/page.tsx`, `prisma/seed.ts` |
| 3 | M1 error mapping, M2 update feedback, L2/L3 | `lib/apiErrors.ts`, `app/api/issues/*`, `components/Dashboard.tsx` |
| 4 | M6 login throttle, M7 JWT re-validate | `lib/loginThrottle.ts`, `auth.ts` |
| 5 | M5 tests, M4 doc note | `playwright.config.ts`, `e2e/*`, `lib/events.ts` |

---

## ไฟล์ใหม่ (New files)

| ไฟล์ | บรรทัด | หน้าที่ | Finding |
|------|:---:|---------|:---:|
| [lib/apiErrors.ts](lib/apiErrors.ts) | 37 | envelope `{error: string}` มาตรฐาน + `zodErrorResponse` + `prismaErrorResponse` (P2025→404, P2003→400) | M1, L3 |
| [lib/loginThrottle.ts](lib/loginThrottle.ts) | 49 | in-memory brute-force throttle (5 ครั้ง/15 นาที → ล็อก 15 นาที) | M6 |
| [playwright.config.ts](playwright.config.ts) | 30 | e2e config (webServer + globalSetup migrate/seed, serial) | M5 |
| [e2e/global-setup.ts](e2e/global-setup.ts) | 10 | `prisma migrate deploy` + `db seed` ก่อนรัน suite | M5 |
| [e2e/helpers.ts](e2e/helpers.ts) | 26 | `login()`, `createIssue()`, บัญชี demo | M5 |
| [e2e/auth.spec.ts](e2e/auth.spec.ts) | 26 | redirect ตอนไม่ล็อกอิน, login ผิด/ถูก | M5 |
| [e2e/authorization.spec.ts](e2e/authorization.spec.ts) | 68 | MEMBER ลบ issue คนอื่น→403, ADMIN ลบได้, assignee ปลอม→400, `?status=bogus`→400 | M5 |
| [e2e/realtime.spec.ts](e2e/realtime.spec.ts) | 49 | multi-tab SSE sync + reconnect-resync (offline→online) | M5 |

---

## ไฟล์ที่แก้ไข (Modified files)

### 🔴 H1 — SSE resync หลังหลุด + จัดการ 401

**[hooks/useIssueStream.ts](hooks/useIssueStream.ts)** — เขียนใหม่ทั้งไฟล์
- `L6–25`: เพิ่ม interface `StreamHandlers { onEvent, onOpen?, onFatal? }`
- `L38`: `es.onopen` → เรียก `onOpen()` ทุกครั้งที่ stream (re)open → trigger resync
- `L49–55`: `es.onerror` → ถ้า `readyState === EventSource.CLOSED` (เช่น 401 ที่ไม่ reconnect) → `onFatal()`; ถ้า CONNECTING (blip ชั่วคราว) ปล่อยให้ auto-reconnect

**[hooks/useIssues.ts](hooks/useIssues.ts)**
- `L10–25`: เพิ่ม helper `reconcile()` — merge ตาม `updatedAt` recency (M3)
- `L47–56` (`applyEvent`): เคส `updated` — ถ้ายังไม่มี issue ให้ insert (กันที่พลาดตอนหลุด), ถ้ามีแล้วใช้ `reconcile()`
- `L61–70`: เพิ่ม `resync()` เรียก `api.fetchIssues()` (เดิมเป็น dead code) แล้ว replace state ทั้งก้อน
- `L72–83`: เปลี่ยนไปเรียก `useIssueStream({ onEvent, onOpen: resync, onFatal → window.location.href='/login' })`

### 🔴 H2 — Seed/login credentials

**[app/login/page.tsx](app/login/page.tsx)** `L95–99`
- ห่อ hint `"Demo: admin@bugboard.dev / admin123"` ด้วย `{process.env.NODE_ENV === "development" && (...)}` → ไม่โชว์บน production build

**[prisma/seed.ts](prisma/seed.ts)** `L7–34`
- `L11–15`: guard — `throw` ถ้า `NODE_ENV=production` เว้นมี `ALLOW_PROD_SEED=true`
- `L19–28`: อ่านรหัสจาก `SEED_ADMIN_PASSWORD`/`SEED_MEMBER_PASSWORD` (dev fallback), บังคับตั้งใน production
- `L33–34`: `bcrypt.hash()` ใช้ตัวแปรจาก env แทน hardcode

### 🟡 M1 — API error mapping (+ L2, L3)

**[app/api/issues/route.ts](app/api/issues/route.ts)**
- `L4,6`: import `listQuerySchema`, helper จาก `apiErrors`
- `L15–22` (GET): validate query ด้วย `listQuerySchema` → `?status=bogus` ได้ 400 (เดิม 500) — **L2**
- `L44–53` (POST): `try/catch` + `prismaErrorResponse(e)` → assignee ปลอม (P2003) ได้ 400 (เดิม 500)

**[app/api/issues/[id]/route.ts](app/api/issues/%5Bid%5D/route.ts)**
- `L2,7`: import `Prisma`, helper จาก `apiErrors`
- `L28–33` (PATCH): `try/catch` map P2025→404, error อื่น (DB ล่ม) → 500 จริง (เดิมกลายเป็น 404 ทั้งหมด)
- `L52–63` (DELETE): จับ P2025 จาก race → คืน `{ok:true}` แบบ idempotent (เดิม 500)
- ทุก response เปลี่ยนเป็น `errorResponse()`/`zodErrorResponse()` → envelope เป็น string เสมอ (**L3**)

### 🟡 M2 — Update status feedback

**[hooks/useIssues.ts](hooks/useIssues.ts)** `L106–122` (`updateStatus`)
- ห่อ `try/catch` + `setMutating`/`setError` แบบเดียวกับ `createIssue`, ใช้ `reconcile()`, แล้ว `throw` ต่อให้ caller

**[components/Dashboard.tsx](components/Dashboard.tsx)**
- `L79–86`: เพิ่ม `handleUpdateStatus()` — เรียก `updateStatus` แล้ว catch → `showToast("Failed to update issue…", "error")`
- `L179`: เปลี่ยน prop `onUpdateStatus={handleUpdateStatus}` (เดิม fire-and-forget ไม่มี feedback)

### 🟡 M6 / M7 — Auth hardening

**[auth.ts](auth.ts)**
- `L7`: import throttle helpers
- `L23–24, 28`: `SESSION_MAX_AGE = 12h` (เดิม default 30 วัน), `REVALIDATE_AFTER_MS = 5m`
- `L36–58` (`authorize`): `isRateLimited()` ก่อน bcrypt (M6), `recordFailure()`/`recordSuccess()` ตามผล
- `L75–96` (`jwt` callback): re-fetch user ทุก 5 นาที (refresh role, `return null` ถ้า user ถูกลบ), guard `process.env.NEXT_RUNTIME === "edge"` ไม่ให้ Prisma รันบน middleware (M7)

### 🟡 M4 — Realtime scale note

**[lib/events.ts](lib/events.ts)** `L9–13`
- คอมเมนต์เตือน single-instance only (ห้าม cluster/serverless จนกว่าจะทำ Redis pub/sub)

### อื่นๆ

**[lib/validation.ts](lib/validation.ts)** `L15–20` — เพิ่ม `listQuerySchema` (status/priority/search) สำหรับ GET
**[package.json](package.json)** `L9–11` — เพิ่ม `typecheck`, `test` scripts; ลบ `playwright` ที่ซ้ำ (`@playwright/test` มีให้แล้ว)

---

## ผลการตรวจสอบ (Verification)

| รายการ | ผล |
|--------|:---:|
| `npx tsc --noEmit` (รวม e2e) | ✅ ผ่าน |
| `npx next build` (รวม Edge middleware) | ✅ ผ่าน — guard `NEXT_RUNTIME` ทำงาน ไม่พัง Edge |
| Error envelope เป็น string (`{"error":"Unauthorized"}`) | ✅ ยืนยัน |
| Auth guard 401 (ไม่มี session) ทุก route | ✅ |
| API authed (400/404) + Playwright e2e | ⚠️ รันไม่ได้ — **DB blocker** |

**DB blocker (environment ไม่ใช่โค้ด):** MySQL บนพอร์ต 3306 ปฏิเสธ `root:bugboard` (`P1000 Authentication failed`) — docker daemon ไม่ได้รัน ทำให้ `authorize()` เจอ `PrismaClientInitializationError` (โค้ดเดิมก็ fail แบบเดียวกัน)

---

## ขั้นตอนที่เหลือ (ต้องมี DB ที่ต่อได้)

```bash
docker compose up -d            # ให้ docker MySQL ขึ้น (creds ตรง .env)
npx prisma migrate deploy
npm run typecheck               # ✅ ผ่านแล้ว
npm run build                   # ✅ ผ่านแล้ว
npm test                        # ⚠️ globalSetup จะ reseed DB (ลบข้อมูล dev) — ชี้ไป test DB แยก
```

## งานที่ยังไม่ทำ (นอกขอบเขตรอบนี้)

- **H3** docker-compose: bind loopback, dedicated user, healthcheck
- **M4** Redis pub/sub จริง (ตอนนี้แค่คอมเมนต์เตือน)
- **LOW**: L1 eslint config, L4 date type/hydration, L5 dead-code cleanup, L7 `AUTH_SECRET`, L8 gitignore `tsconfig.tsbuildinfo`, L9 README, L10 pagination/index/fulltext/next-auth beta pin
