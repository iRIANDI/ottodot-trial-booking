# Ottodot Engineering Agent Constitution & Technical Specification
*System Role: AI Pair Programmer & Reliability Guardian • Framework: TypeScript / Node.js / SQLite ACID*

This document defines the strict operational rules, architectural invariants, and behavioral boundaries for any AI Agent for Google Antigravity (powered by Gemini) operating on the **Ottodot Trial Booking Reliability Engine**.

---

## 🎯 System Mission & Domain Boundaries
Ottodot provides live online science and math classes for children (ages 7-12) anchored in interactive Roblox worlds.
- **Core Domain Rule**: Trial classes are capped strictly at **4 students per class**.
- **Scope Restriction**: This codebase implements **trial class booking only**. It explicitly excludes regular enrollment, multi-week subscriptions, and complex user authentication.
- **Zero-Tolerance Invariant**: The database must **NEVER** allow > 4 confirmed students in a trial class, under any concurrency load or race condition.

---


## 🌐 Language & Localization Constitution (100% English Requirement)
- **STRICT MANDATE**: All user interfaces, buttons, badges, helper texts, table headers, form labels, modal dialogs, error messages, code comments, API logs, and documentation across the entire Ottodot repository MUST strictly be written in **professional, native US/UK English**.
- **PROHIBITION**: Never use Indonesian words, mixed Indonesian-English phrases (e.g., "Daftar Siswa Terkonfirmasi", "Pilih untuk Diuji", "TARGET UJI AKTIF", "Sedang Dipilih"), or bilingual clutter in production UI views. Ottodot is an international edtech platform evaluated by a global engineering panel.




## 🧗 Senior Developer Decision Ladder & Architectural Map Mandate
- **STRICT MANDATE**: For ANY task, refactoring, feature development, or debugging in this repository, all AI Agents and engineers MUST strictly consult and adhere to:
  1. `.agents/PONYTAIL.md`: Follow the 4-Rung Decision Ladder (Rung 1: Native First -> Rung 2: Reuse First -> Rung 3: Configuration First -> Rung 4: Surgical Diff). Eliminate context bloat, conserve tokens, and avoid unnecessary dependencies.
  2. `.agents/graphify/GRAPH_REPORT.md`: Consult the architectural knowledge base for O(1) codebase dependency lookup, domain entity mappings, invariant guardrails, and service boundaries before writing or modifying any code.

## 🚫 Strict Prohibition of Native JavaScript Popups (Zero alert(), confirm(), prompt())
- **HARAM HUKUMNYA / STRICTLY PROHIBITED**: Never use native browser dialogs (`window.alert()`, `window.confirm()`, `window.prompt()`, or inline `onclick="return confirm(...)"`) anywhere in the application. They look unprofessional, block browser threads, disrupt automated UI testing, and degrade mobile UX.
- **MANDATORY REPLACEMENT**: All user alerts, success feedbacks, or error notifications MUST use modern UI elements: styled toast notifications (e.g. animated floating toasts with backdrop blurs and auto-dismiss) or elegant accessible modal sheets.

## ⏱️ Concurrency Timestamp Verification & Realistic Swarm Simulation
- In any concurrency benchmark or stress test, simulated concurrent requests MUST capture:
  1. High-resolution dispatch timestamp down to the millisecond (`HH:mm:ss.SSS`).
  2. Individual execution latency (`ms`).
  3. Structured participant metadata (realistic parent & child bot identities rather than opaque hardcoded counters).
- The audit log MUST display these timestamps side-by-side so reviewers can independently verify that all concurrent transactions were truly dispatched in the same millisecond window.

## 📚 Continuous Documentation Synchronization Rule (Living Documentation Mandate)
- **STRICT MANDATE**: Code and documentation must never drift apart. Whenever any feature, endpoint, invariant, UX layout, or architectural behavior is modified, the AI Agent MUST proactively update and synchronize all corresponding documentation files in the repository:
  1. `README.md`: High-level system overview, quick-start, architecture, and feature descriptions.
  2. `SMART_GUIDE.md`: Reviewer-facing architectural deep dives, AI steering reflections, and invariant proofs.
  3. `AI_USAGE.md`: Chronological reflection of human-in-the-loop AI steering cycles.
  4. `.agents/graphify/GRAPH_REPORT.md`: Architectural dependency graph, service interactions, and system components.
  5. `AGENTS.md` & `.agents/AGENTS.md`: Agent constitutions and non-negotiable operational rules.
- **NO STALE DOCS**: Submitting code changes without synchronizing the corresponding documentation is considered an engineering failure.



## 🎓 Educational UI/UX & Test Bench Clarity Mandate
- **No Ambiguous Reset or Action Labels**: Test bench action buttons must clearly communicate their exact scope and consequence:
  - Differentiate clearly between **Global Reset** (`Reset Entire Dataset to Baseline`) and **Targeted Class Actions**.
  - Never affix misleading dynamic suffixes (such as `(3/4)`) to classes that are full (`4/4`) or have open seats (`1/4`).
- **Proactive Case Study Guidance**: The UI must present an explicit **Case Study Guide** outlining the intended purpose of each seeded test session:
  1. *Scenario 1 (Mars Rover Physics, 3/4)*: The canonical **Last-Seat Race Condition Target** (1 seat left).
  2. *Scenario 2 (Geometry Castle Defense, 4/4)*: The **Overbooking Immunity Guard** (sold-out class).
  3. *Scenario 3 (Multiplication Volcano, 1/4)*: The **Standard Single Booking Happy Path** (3 seats open).
- **Preserve Active State on Reset**: When a reviewer clicks to reset dataset state, preserve the reviewer's currently selected class so their testing flow is not unexpectedly hijacked.

## 🗄️ Database Architecture & ULID Primary Key Mandate
- **Database Engine & File**: Embedded ACID SQLite 3 with WAL Mode (`journal_mode = WAL`) and Foreign Keys enabled (`PRAGMA foreign_keys = ON`).
  - **Database File**: `ottodot_trial.sqlite` (in project root) for production/dev runtime.
  - **In-Memory Database**: `:memory:` with isolated schemas for high-speed Vitest automated test suites.
- **PROHIBITION OF AUTO_INCREMENT**: Never use sequential `INTEGER PRIMARY KEY AUTOINCREMENT`. Sequential IDs create insecure enumerable URLs (IDOR attacks), cause write bottlenecks under horizontal distribution, and rebalance B-Tree indexes unpredictably.
- **MANDATORY USE OF ULID**: All dynamically created database entities (`bookings`, `payment_attempts`) MUST use **26-character Crockford Base32 ULIDs** (`ulid()`). ULIDs provide 48-bit millisecond timestamp sorting for $O(1)$ B-tree index locality and 80-bit cryptographic entropy for zero collision across distributed nodes.


## 🛡️ Strict Slop-Prevention & Bug Defense Guidelines (Future Invariants)

To ensure zero architectural slop, UI regressions, or broken reviewer experiences, all AI agents and developers must strictly obey the following 5 laws:

### 1. Zero Ambiguity in Test Bench Actions & State Resets
- **Clear Action Semantics**: Never label a global reset button with class-specific or misleading capacity tags (e.g., do NOT append `(3/4)` to a reset button when the active class is `4/4`).
- **Preserve Active Context**: When a user or reviewer triggers a dataset reset or refresh, NEVER hijack their focus. Always preserve the active selected item (`const current = activeClassId; await reset(); activeClassId = current;`).
- **Interactive Scaffolding**: Always provide explicit Case Study Cards explaining the purpose of each seeded test entity (e.g., Scenario 1 = Last-Seat Race Target at 3/4, Scenario 2 = Overbooking Guard at 4/4, Scenario 3 = Open Happy Path at 1/4).

### 2. Dual-Theme CSS Token Discipline (No Dark Mode Glitches)
- **Zero Framework Disconnect**: When using Bootstrap, Tailwind, or custom themes, NEVER apply utility classes like `bg-body-tertiary` or `bg-white` without binding them to reactive CSS variables.
- **Synchronize Theme Attributes**: Always synchronize framework attributes alongside custom dataset tags:
  ```javascript
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-bs-theme', theme);
  ```
- **Contrast Verification**: In Dark Mode, backgrounds must use deep navies (`#0f172a`, `#151d30`) and light texts (`#f1f5f9`, `#94a3b8`). Blinding white backgrounds inside dark mode are strictly prohibited.

### 3. Scalability & Primary Key Standardization (ULID Invariant)
- **No AUTO_INCREMENT**: Never use sequential auto-incrementing integer IDs. They expose systems to IDOR enumeration attacks and fail in distributed environments.
- **No Pseudo-Random Strings**: Never generate IDs with `Math.random().toString(36)`. Random hashes fragment database B-Tree index pages.
- **Mandatory ULID**: All dynamic business entities (`bookings`, `payment_attempts`) MUST use **26-character Crockford Base32 ULIDs** (`src/utils/ulid.ts`). ULIDs combine a 48-bit millisecond timestamp for $O(1)$ B-tree index appends with 80-bit cryptographic entropy for zero distributed collisions.

### 4. Concurrency Invariant Enforcement (Zero TOCTOU)
- **Database Engine as Supreme Arbiter**: Never perform capacity checks in application memory (`SELECT count(*) ... if (count >= 4) throw`).
- **Atomic Conditional Mutation**: Always acquire seats via atomic SQL conditional queries:
  ```sql
  UPDATE trial_classes SET confirmed_count = confirmed_count + 1 WHERE id = ? AND confirmed_count < capacity;
  ```
- **Automatic Compensation**: If conditional acquisition fails (`changes === 0`), roll back immediately and trigger an instant automated refund.

### 5. Reviewer-Centric Transparency
- When an AI suggests shortcuts (e.g., omitting automated refund logic, relying on frontend buttons for validation, or dropping documentation sections), the engineer MUST intervene, reject the shortcut, and document the architectural reasoning in `SMART_GUIDE.md` and `AI_USAGE.md`.

## ⚖️ Non-Negotiable Database Invariants

Every AI Agent modifying this codebase must uphold these 4 mathematical invariants:

1. **Anti-Duplicate Booking Invariant**:
   - A child cannot be confirmed more than once for the same trial class session.
   - *Enforcement Mechanism*: Partial unique index in database kernel:
     ```sql
     CREATE UNIQUE INDEX idx_unique_confirmed_child_booking 
     ON bookings (trial_class_id, student_id) 
     WHERE status = 'confirmed';
     ```

2. **Anti-Overbooking Invariant (Max 4 Students)**:
   - *Enforcement Mechanism*: Atomic conditional query at the database write layer:
     ```sql
     UPDATE trial_classes 
     SET confirmed_count = confirmed_count + 1 
     WHERE id = :class_id AND confirmed_count < capacity;
     ```
   - Backed by table-level check constraint: `CHECK (confirmed_count <= capacity)`.

3. **Payment Failure Isolation**:
   - Unsuccessful charges must never enter the roster.
   - Status transitions: `pending_payment` ➔ `payment_failed`.
   - Roster projections must strictly filter: `WHERE bookings.status = 'confirmed'`.

4. **Race Condition Handling (The Last-Seat Race)**:
   - When User A and User B concurrently submit checkout for the 4th seat, the database serializes write access.
   - The winner (`changes === 1`) transitions to `confirmed`.
   - The loser (`changes === 0`) transitions to `rejected_class_full`, and the system issues an **automated instant refund ($25.00)** with zero manual intervention.

---

## 🚫 The 4 Forbidden Anti-Patterns (HARAM untuk AI Agent)

1. **NO Application-Level Concurrency Checks (Anti-TOCTOU)**:
   - ❌ **STRICTLY FORBIDDEN**: Writing `if (class.confirmed_count < 4)` in JavaScript before charging. In concurrent environments, this causes Time-of-Check to Time-of-Use failure and overbooks the class.
   - ✅ **MANDATORY**: Let the database atomic update decide whether the seat is won.

2. **NO Raw SQL String Concatenation**:
   - ❌ **STRICTLY FORBIDDEN**: `db.query("SELECT * FROM students WHERE id = '" + id + "'")`
   - ✅ **MANDATORY**: Always use parameterized statements (`db.prepare(...).get(id)`) to prevent SQL injection.

3. **NO Pessimistic Cart Locks (The 10-Minute Cart Hold Fallacy)**:
   - ❌ **STRICTLY FORBIDDEN**: Locking seats when a parent enters checkout. Cart abandonment locks seats from genuine parents (*seat hoarding*).
   - ✅ **MANDATORY**: Optimistic finalization with automated refund compensation.

4. **NO Heavy Framework Boilerplate**:
   - ❌ **STRICTLY FORBIDDEN**: Pulling Prisma, Docker, NextAuth, or microservices for this focused slice. Respect the 3-4 hour timebox and keep tests running sub-second.

---

## 🪜 Senior Developer Decision Protocol
Always adhere to [.agents/PONYTAIL.md](./.agents/PONYTAIL.md):
- **Rung 1**: Native First (Exhaust SQLite / PostgreSQL atomic primitives).
- **Rung 2**: Reuse First (Consult [.agents/graphify/graph.json](./.agents/graphify/graph.json)).
- **Rung 3**: Configuration First (Declarative schemas & strict TypeScript types).
- **Rung 4**: Surgical Diff (Minimal, targeted edits).

---

## 🧪 Verification Protocol
Before finishing any turn, the agent MUST run:
```bash
npm test
```
All test suites (including 2-user race conditions, 10-user peak rush storms, duplicate prevention, payment decline, and teacher roster export) must pass with zero failures.
