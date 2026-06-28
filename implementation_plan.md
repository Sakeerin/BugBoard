# BugBoard — Implementation Plan (v2)

> Mini issue tracker สำหรับทีมวิศวกรรม — เวอร์ชันเต็มรูปแบบ
> Next.js App Router + TypeScript + Tailwind + **MySQL (Prisma)** + **Auth.js** + **Real-time (SSE)**

---

## 0. สรุปการเปลี่ยนแปลงจาก v1 → v2

| ด้าน | v1 (เดิม) | v2 (ใหม่) |
|------|----------|-----------|
| Storage | ไฟล์ JSON ฝั่ง server | **MySQL** ผ่าน **Prisma ORM** |
| Auth | ไม่มี | **Auth.js (NextAuth v5)** — credentials + role (ADMIN/MEMBER) |
| Backend | Route Handlers (เปิด) | Route Handlers **ที่ป้องกันด้วย session** + ownership checks |
| Real-time | ไม่มี (ต้อง refresh) | **Server-Sent Events** + event bus (มี seam สำหรับ Redis pub/sub) |
| Delete | ไม่มี | **DELETE ถาวร** (role-gated + confirm dialog + broadcast) |
| assignee | string | **FK → User** (relation จริง) |
| Deploy | Node host / file | Node host + **MySQL จัดการแยก** (เช่น Azure Database for MySQL) |

> หลักการ migration: layer ที่แตะข้อมูลทั้งหมดถูกห่อไว้ใน `lib/db.ts` (v1) → v2 เปลี่ยนภายในไฟล์นั้นไปเรียก Prisma แทน fs โดย UI/hook แทบไม่ต้องแก้ ยกเว้นส่วนที่เพิ่ม auth + realtime + delete

---

## 1. สถาปัตยกรรมรวม (v2)

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Client Components)                                  │
│    hooks/useIssues.ts ──┬─ lib/api.ts ─▶ REST (mutations)    │
│    hooks/useIssueStream ─┘                                    │
│            ▲ EventSource (SSE: live create/update/delete)     │
└────────────┼──────────────────────────────────────────────────┘
             │
┌────────────┼──────────────────────────────────────────────────┐
│  Next.js Server (Route Handlers)                              │
│    /api/auth/[...nextauth]   ── Auth.js (session, login)      │
│    /api/issues  GET/POST     ── ต้องมี session                │
│    /api/issues/[id] PATCH/DELETE                              │
│    /api/issues/stream  GET   ── SSE endpoint                  │
│            │                         ▲                         │
│            ▼                         │ emit                    │
│    lib/db.ts (Prisma) ──▶ MySQL     lib/events.ts (bus)       │
│            │                         │                         │
│            └── หลัง mutation สำเร็จ ──┘  (+ Redis pub/sub ตอน scale)│
└──────────────────────────────────────────────────────────────┘
             │
        ┌────▼────┐
        │  MySQL  │  (Azure Database for MySQL / PlanetScale / local Docker)
        └─────────┘
```

---

## 2. Tech Stack (เพิ่มเติม)

| ส่วน | เทคโนโลยี | หมายเหตุ |
|------|-----------|----------|
| ORM | **Prisma** | type-safe, migration, ทำงานกับ MySQL ดี |
| Database | **MySQL 8** | dev: Docker, prod: Azure Database for MySQL |
| Auth | **Auth.js v5 (`next-auth`)** + `@auth/prisma-adapter` | credentials provider + (option) GitHub OAuth |
| Password | **bcryptjs** | hash รหัสผ่าน |
| Real-time | **SSE** (native) + `EventEmitter` | option: `ioredis` (pub/sub) หรือ Pusher/Ably ตอน scale |
| Validation | **zod** | ใช้ทั้ง API และฟอร์ม (แทน validate มือใน v1) |

> เดิม v1 ตั้งใจให้เบา ไม่พึ่ง zod — v2 มีหลาย entity และ auth จึงคุ้มที่จะใช้ zod เป็น single source of truth ของ schema

---

## 3. Database Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum Role     { ADMIN MEMBER }
enum Priority { low medium high critical }
enum Status   { open in_progress resolved }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String?
  role         Role     @default(MEMBER)
  image        String?
  createdAt    DateTime @default(now())

  reportedIssues Issue[] @relation("Reporter")
  assignedIssues Issue[] @relation("Assignee")

  accounts Account[]
  sessions Session[]
}

model Issue {
  id          String   @id @default(cuid())
  title       String
  description String   @db.Text
  priority    Priority
  status      Status   @default(open)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  reporterId String
  reporter   User   @relation("Reporter", fields: [reporterId], references: [id])

  assigneeId String?
  assignee   User?  @relation("Assignee", fields: [assigneeId], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([priority])
  @@index([createdAt])
  @@index([reporterId])
}

// ----- Auth.js adapter models -----
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}
```

**Migration & seed**
```bash
npx prisma migrate dev --name init     # สร้างตาราง
npx prisma db seed                      # seed users + 6 issues (prisma/seed.ts)
```
seed สร้าง: ผู้ใช้ตัวอย่าง 3 คน (1 ADMIN, 2 MEMBER) พร้อมรหัสผ่าน hash แล้ว และ 6 issues ผูก reporter/assignee เข้ากับ user เหล่านั้น (กระจาย status/priority เหมือน v1)

---

## 4. Authentication (Auth.js v5)

### 4.1 การตั้งค่า
- ไฟล์ `auth.ts` (root) export `{ handlers, auth, signIn, signOut }`
- adapter: `PrismaAdapter(prisma)`, session strategy: **JWT** (ใส่ `role` ลง token)
- providers:
  - **Credentials** (email + password) → ตรวจกับ `passwordHash` ด้วย `bcrypt.compare`
  - (ตัวเลือก) **GitHub OAuth** สำหรับ SSO ภายในทีม
- route: `app/api/auth/[...nextauth]/route.ts` → `export const { GET, POST } = handlers`

### 4.2 ป้องกันหน้า/route ด้วย middleware
```typescript
// middleware.ts
export { auth as middleware } from "@/auth";
export const config = {
  matcher: ["/((?!api/auth|login|_next|favicon.ico).*)"],
};
```
- ยังไม่ login → redirect ไป `/login`
- หน้า `/login` = client form เรียก `signIn("credentials", {...})`
- header ของ dashboard แสดงชื่อ/avatar + ปุ่ม Sign out

### 4.3 อ่าน session ใน Route Handler
```typescript
const session = await auth();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
const role = session.user.role;
```

---

## 5. Authorization — Permission Matrix

| การกระทำ | MEMBER | ADMIN | เงื่อนไข |
|----------|:------:|:-----:|----------|
| ดู issue ทั้งหมด | ✅ | ✅ | ต้อง login |
| สร้าง issue | ✅ | ✅ | `reporterId = session.user.id` |
| เปลี่ยน status (resolve) | ✅ | ✅ | ทุก member ทำได้ |
| **ลบ issue ถาวร** | ⚠️ | ✅ | MEMBER ลบได้เฉพาะ issue ที่ตัวเอง report; ADMIN ลบได้ทุกอัน |
| จัดการผู้ใช้ | ❌ | ✅ | (อนาคต) |

> บังคับ rule ทั้งสองชั้น: **client** (ซ่อนปุ่มที่ไม่มีสิทธิ์ เพื่อ UX) และ **server** (ตรวจซ้ำใน Route Handler เพื่อความปลอดภัยจริง — client check ไว้ใจไม่ได้)

---

## 6. Backend API (v2)

| Method | Route | Auth | คำอธิบาย |
|--------|-------|------|----------|
| `*` | `/api/auth/[...nextauth]` | — | Auth.js |
| GET | `/api/issues` | session | list + stats (join reporter/assignee) |
| POST | `/api/issues` | session | สร้าง (reporter = current user) → **emit `created`** |
| PATCH | `/api/issues/[id]` | session | เปลี่ยน status → **emit `updated`** |
| DELETE | `/api/issues/[id]` | session + ownership | **ลบถาวร** → **emit `deleted`** |
| GET | `/api/issues/stream` | session | **SSE** stream เหตุการณ์ |

**DELETE handler (สรุป logic)**
```typescript
const session = await auth();
if (!session?.user) return unauthorized();
const issue = await prisma.issue.findUnique({ where: { id } });
if (!issue) return notFound();
const canDelete =
  session.user.role === "ADMIN" || issue.reporterId === session.user.id;
if (!canDelete) return forbidden();           // 403
await prisma.issue.delete({ where: { id } }); // ลบถาวรจริง
emitIssueEvent({ type: "deleted", id });
return NextResponse.json({ ok: true });
```

---

## 7. Real-time Sync

### 7.1 แนวทางหลัก — Server-Sent Events (SSE)
เลือก SSE เพราะ: ทำงานบน Route Handler ได้เลย, ไม่ต้องตั้ง WebSocket server แยก, ทิศทาง server→client (พอสำหรับ live updates), reconnect อัตโนมัติในตัว

**Event bus (`lib/events.ts`)** — singleton EventEmitter (ผูกกับ `globalThis` กัน HMR สร้างซ้ำ)
```typescript
type IssueEvent =
  | { type: "created"; issue: Issue }
  | { type: "updated"; issue: Issue }
  | { type: "deleted"; id: string };

const bus = (globalThis.__bugboardBus ??= new EventEmitter());
export const emitIssueEvent = (e: IssueEvent) => bus.emit("issue", e);
export const onIssueEvent = (fn: (e: IssueEvent) => void) => {
  bus.on("issue", fn);
  return () => bus.off("issue", fn);
};
```

**SSE endpoint (`/api/issues/stream`)**
```typescript
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (e: IssueEvent) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(
        () => controller.enqueue(enc.encode(": ping\n\n")),
        25000
      );                                   // กัน proxy ตัด idle connection
      const off = onIssueEvent(send);
      // cleanup เมื่อ client หลุด
      // @ts-ignore
      controller.signal?.addEventListener?.("abort", () => { off(); clearInterval(ping); });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

**Client hook (`hooks/useIssueStream.ts`)**
```typescript
useEffect(() => {
  const es = new EventSource("/api/issues/stream");
  es.onmessage = (msg) => {
    const e = JSON.parse(msg.data) as IssueEvent;
    applyEvent(e);   // อัปเดต state ในหน่วยความจำ + recompute stats
  };
  es.onerror = () => { /* EventSource reconnect ให้เองอัตโนมัติ */ };
  return () => es.close();
}, []);
```

### 7.2 Optimistic UI + dedupe
- ผู้กระทำเห็นผลทันที (optimistic) แล้ว SSE มายืนยัน
- กัน toast/บรรทัดซ้ำด้วยการ reconcile ตาม `issue.id` (event ที่ id มีอยู่แล้วถือว่าซ้ำ)

### 7.3 การ scale (หลายอินสแตนซ์)
EventEmitter ทำงานภายใน process เดียว ถ้ารันหลายอินสแตนซ์ event จะไม่ข้ามเครื่อง → ใส่ **Redis pub/sub** (`ioredis`): mutation publish ไป channel `issues`, ทุกอินสแตนซ์ subscribe แล้ว re-emit เข้า bus ของตัวเอง (โครงเดิมไม่เปลี่ยน เพิ่มแค่ adapter)

### 7.4 ทางเลือกอื่น
- **Pusher / Ably** (managed) — เหมาะถ้า deploy บน Vercel serverless ที่ถือ connection ยาวไม่ได้
- **Socket.IO** — ต้องมี custom Node server, ได้ bi-directional แต่ deploy ซับซ้อนกว่า

---

## 8. Permanent Delete — User Flow

1. การ์ด issue มีปุ่ม/เมนู **Delete** (แสดงเฉพาะผู้มีสิทธิ์ตาม matrix)
2. กด → เปิด **confirm dialog** ("Delete this issue permanently? This can't be undone.")
3. ยืนยัน → `DELETE /api/issues/[id]`
4. สำเร็จ → ลบออกจาก list (optimistic), toast "Issue deleted", stats ลด, และ **broadcast `deleted`** ให้ทุก client เอาออกพร้อมกัน
5. ถ้า 403 (ไม่มีสิทธิ์) → toast error และคง issue ไว้

---

## 9. โครงสร้างโปรเจกต์ (เพิ่ม/เปลี่ยนจาก v1)

```
bugboard/
├── prisma/
│   ├── schema.prisma          # ★ ใหม่ — schema MySQL
│   └── seed.ts                # ★ ใหม่ — seed users + issues
├── auth.ts                    # ★ ใหม่ — config Auth.js
├── middleware.ts              # ★ ใหม่ — ป้องกัน route
├── app/
│   ├── login/page.tsx         # ★ ใหม่ — หน้า sign in
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # ★ ใหม่
│   │   └── issues/
│   │       ├── route.ts                  # ปรับ: + auth, Prisma
│   │       ├── [id]/route.ts             # ปรับ: + DELETE, ownership
│   │       └── stream/route.ts           # ★ ใหม่ — SSE
│   ├── layout.tsx             # + SessionProvider
│   └── page.tsx               # + ปุ่ม delete, ข้อมูล user
├── lib/
│   ├── prisma.ts              # ★ ใหม่ — Prisma client singleton
│   ├── db.ts                  # ปรับ: fs → Prisma queries
│   ├── events.ts             # ★ ใหม่ — event bus
│   ├── validation.ts          # ★ ใหม่ — zod schemas
│   └── api.ts                 # + deleteIssue()
├── hooks/
│   ├── useIssues.ts           # + delete, + รวม stream
│   └── useIssueStream.ts      # ★ ใหม่
└── components/
    ├── ConfirmDialog.tsx      # ★ ใหม่
    ├── UserMenu.tsx           # ★ ใหม่ — avatar + sign out
    └── IssueCard.tsx          # + ปุ่ม delete (ตามสิทธิ์)
```

---

## 10. Environment Variables (`.env`)

```bash
# Database
DATABASE_URL="mysql://user:pass@localhost:3306/bugboard"

# Auth.js
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="http://localhost:3000"

# (ตัวเลือก) GitHub OAuth
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."

# (ตัวเลือก) Redis สำหรับ scale realtime
REDIS_URL="redis://localhost:6379"
```

---

## 11. Deployment (v2)

- **Database**: ใช้ managed MySQL — แนะนำ **Azure Database for MySQL** (อยู่ใน stack ที่ใช้อยู่) หรือ PlanetScale; รัน `prisma migrate deploy` ใน CI/CD
- **App + SSE**: ต้องการ host ที่ถือ long-lived connection ได้ → **Railway / Render / Fly.io / Azure App Service / Docker บน VM** (เช่น `prod-agent-vm`)
- **บน Vercel**: serverless ไม่เหมาะกับ SSE ค้างยาว → สลับ realtime ไปใช้ **Pusher/Ably** (โค้ดฝั่ง emit เปลี่ยน adapter เดียว)
- รัน migration ตอน deploy, อย่า commit `.env`

---

## 12. แผนลงมือทำเป็นเฟส (v2)

**Phase A — Database & ORM**
- [x] ติดตั้ง Prisma + MySQL (Docker compose สำหรับ dev)
- [x] เขียน `schema.prisma`, รัน `migrate dev`
- [x] `lib/prisma.ts` singleton, ย้าย `lib/db.ts` จาก fs → Prisma
- [x] `prisma/seed.ts` (users + issues)

**Phase B — Authentication**
- [x] ติดตั้ง `next-auth@5` + `@auth/prisma-adapter` + `bcryptjs`
- [x] `auth.ts` (Credentials + role ใน JWT), `[...nextauth]/route.ts`
- [x] `middleware.ts`, หน้า `/login`, `UserMenu`, SessionProvider
- [x] ใส่ auth guard + ownership ใน API ทุกตัว

**Phase C — Permanent Delete**
- [x] `ConfirmDialog`, ปุ่ม delete ตามสิทธิ์
- [x] `DELETE /api/issues/[id]` + ownership check
- [x] `deleteIssue()` ใน api.ts + hook + optimistic

**Phase D — Real-time**
- [x] `lib/events.ts`, `/api/issues/stream` (SSE)
- [x] emit หลัง create/update/delete
- [x] `useIssueStream`, reconcile + dedupe
- [ ] (option) Redis pub/sub adapter

**Phase E — Polish & Deploy**
- [x] zod validation รวมศูนย์, จัดการ error/permission UI
- [x] ทดสอบ multi-tab realtime
- [ ] ตั้ง MySQL prod + migrate + deploy

---

## 13. User Flows สำหรับ External Web Testing Agent (v2)

ครอบคลุมของเดิม + เพิ่ม auth/delete/realtime:

**Auth**
1. **Redirect เมื่อยังไม่ login** — เปิด `/` โดยไม่มี session → ถูกพาไป `/login`
2. **Login สำเร็จ** — กรอก credential ถูก → เข้า dashboard, header แสดงชื่อผู้ใช้
3. **Login ผิด** — รหัสผิด → error message, ไม่เข้าระบบ
4. **Sign out** — กด sign out → กลับหน้า login, เข้า `/` ไม่ได้อีก

**Core (เหมือน v1, ตอนนี้ต้อง login ก่อน)**
5. First load: 6 issues, การ์ดสรุป Open=2/In Progress=2/Resolved=2/Critical=2
6. Create (happy/sad path), Search, Filter (AND), Mark resolved — ตามเดิม

**Permanent Delete**
7. **ลบโดยเจ้าของ** — MEMBER ลบ issue ที่ตัวเอง report → confirm → หายถาวร, toast, stats ลด
8. **ลบโดยไม่มีสิทธิ์** — MEMBER พยายามลบ issue ของคนอื่น → ปุ่มไม่แสดง / ถ้ายิง API ตรงได้ 403
9. **ADMIN ลบได้ทุกอัน** — login เป็น ADMIN → ลบ issue ของใครก็ได้
10. **ยกเลิกใน confirm** — กด delete แล้วกด cancel → issue ยังอยู่

**Real-time**
11. **Multi-tab sync** — เปิด 2 แท็บ; สร้าง issue ในแท็บ A → แท็บ B เห็นทันทีโดยไม่ refresh
12. **Resolve sync** — resolve ในแท็บ A → สถานะ + การ์ดสรุปอัปเดตในแท็บ B
13. **Delete sync** — ลบในแท็บ A → issue หายจากแท็บ B ทันที
14. **Reconnect** — ตัดเน็ตชั่วครู่แล้วต่อใหม่ → stream กลับมารับ event ต่อได้

**Persistence**
15. สร้าง/แก้/ลบ แล้ว refresh → ข้อมูลตรงกับ DB (ไม่ใช่ in-memory)

---

## 14. Security Checklist

- ตรวจ auth + ownership **ฝั่ง server เสมอ** (client check แค่เพื่อ UX)
- hash รหัสผ่านด้วย bcrypt, ไม่เก็บ plaintext, ไม่ส่ง `passwordHash` ออก API
- validate ทุก input ด้วย zod ก่อนแตะ DB (กัน injection ผ่าน Prisma parameterized อยู่แล้ว)
- `AUTH_SECRET` แข็งแรง, cookie `httpOnly` + `secure` (prod)
- SSE endpoint ตรวจ session ก่อนเปิด stream
- rate-limit endpoint login (กัน brute force) — option

---

## สรุป

v2 ยกระดับ BugBoard เป็นแอปจริงสำหรับทีม: ข้อมูลอยู่ใน **MySQL** ผ่าน Prisma, มี **authentication + role-based permissions**, **ลบ issue ถาวร** แบบมี ownership check และ **real-time sync** ข้ามผู้ใช้/แท็บด้วย SSE (พร้อม seam สำหรับ Redis/Pusher ตอน scale) — ทุกส่วนมี schema, โค้ดตัวอย่าง, permission matrix, checklist รายเฟส และ user flows สำหรับทดสอบครบถ้วน ลงมือทำตาม Phase A–E ได้ทันที
