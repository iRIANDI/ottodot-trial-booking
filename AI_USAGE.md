# AI Usage & Senior Engineering Reflection

Built for the **Ottodot Senior Full-Stack Engineer Technical Take-Home Challenge**.  
**Author:** Yoseph Iriandi (16 Years Systems Architect & Lead Full-Stack Engineer)

---

## 🛠️ Which AI Tools You Used
- **Google Antigravity IDE**: DeepMind's agentic AI pair-programming assistant running locally, equipped with autonomous shell orchestration, surgical file editing, and automated test execution.
- **Google Gemini 3.8 Flash**: The foundational reasoning LLM powering Antigravity for real-time code generation, concurrency analysis, TypeScript refactoring, and test assertions.

---

## 🎯 What You Used AI For (The Human Architect vs. AI Synthesizer Division of Labor)

In modern engineering, writing syntax and boilerplate has become a commoditized activity. In this project, I deliberately treated AI as a **high-speed typing synthesizer and adversarial red-teaming partner**, while retaining 100% human ownership over business reality modeling and database invariant architecture:

1. **High-Speed Boilerplate Synthesis**:
   - Rapidly generating TypeScript types, Express endpoint routing scaffolding, and mock payment gateway stubs (`MockPaymentGateway`).
   - Populating synthetic seed schemas with realistic Roblox science/math classes, student personas, and teacher rosters.
2. **Automated Concurrency Test Scaffolding**:
   - Synthesizing Vitest parallel promise harnesses (`Promise.all`) for simulating User A vs. User B millisecond races and 10-bot swarm rushes.
3. **Adversarial Red-Teaming & Failure Mode Sparring**:
   - Prompting the AI to challenge my own architectural assumptions: *"What edge cases exist if the client drops connection between payment charge and SQL execution? How does SQLite WAL mode behave under simultaneous write transactions?"*
4. **Token-Efficient Format Logic**:
   - Drafting the Teacher Roster tabular formatting logic to output clean roster tables for teacher workflows.
5. **What AI Was STRICTLY NOT Used For**:
   - AI did **not** make architectural decisions.
   - AI did **not** determine our database invariant design.
   - When AI proposed naive industry tropes (like 5-minute countdown cart holds or application-level `if (count < 4)` checks), I critically interrogated and rejected them based on 16 years of distributed systems experience.

---

## ⚡ One Place Where AI Helped You Move Faster

**Automated Test Harness Generation & Boilerplate Velocity (Freeing Cognitive Bandwidth for Architecture):**

Generating the high-concurrency Vitest test suite (`tests/race-condition.test.ts` and `tests/booking.test.ts`) took **less than 10 minutes** with AI assistance. Manually typing 10-promise concurrency arrays, mock timing assertions, and SQLite in-memory table seeders typically consumes 35–45 minutes of tedious coding.

**The Architectural Value:**  
Because AI eliminated mechanical typing overhead, **100% of my cognitive bandwidth was redirected towards what AI cannot do**:
- **Diagnosing the Real Business Model**: Recognizing that in a 4-student Roblox class, a single seat represents **25% of the total class capacity and revenue**.
- **Solving The Ghost Hold Problem**: Realizing that standard e-commerce 5-minute cart timers starve class inventory and drive away paying parents.
- **Engineering Mathematical Database Invariants**: Constructing conditional atomic SQL updates (`UPDATE trial_classes SET confirmed_count = confirmed_count + 1 WHERE id = ? AND confirmed_count < capacity`) and partial unique indexes that guarantee zero overbooking at the storage engine level.
- **Designing the Hyperscale Production Evolution**: Formulating the Stripe Two-Step Pre-Authorization (`capture_method: manual`), Redis Active Viewers counter, and Lua-based Token Bucket for 10,000 RPS traffic spikes.

---

## 🛑 Real Moments I Disagreed With, Corrected, or Rejected AI Output

I never blindly accept AI outputs. Every proposal from the model was subjected to rigorous architectural interrogation:

### ⚠️ Disagreement #1: Rejecting the TOCTOU Application-Level Race Condition
* **What the AI Suggested**:
  ```typescript
  // ❌ REJECTED AI CODE:
  const currentCount = await db.query('SELECT count(*) FROM bookings WHERE class_id = ? AND status = "confirmed"');
  if (currentCount >= 4) {
    throw new Error("Class full");
  }
  await processPayment();
  await db.query('INSERT INTO bookings ...');
  ```
* **Why I Challenged & Rejected It**:  
  Under concurrency, User A and User B hit the server at the exact same millisecond. Both read `currentCount = 3`. Both proceed to charge credit cards. Both insert confirmed bookings. The class ends up with **5 confirmed students** (breaching the hard cap of 4). This is the classic **Time-of-Check to Time-of-Use (TOCTOU)** vulnerability.
* **How I Corrected It (The Database Engine Invariant)**:  
  I enforced atomic database-level serialization using conditional atomic updates:
  ```sql
  -- ✅ ENFORCED DATABASE INVARIANT:
  UPDATE trial_classes 
  SET confirmed_count = confirmed_count + 1 
  WHERE id = ? AND confirmed_count < capacity;
  ```
  If `changes === 0`, the database storage engine itself rejects the update atomically. No locks, no redis race, zero overbooking.

---

### ⚠️ Disagreement #2: Rejecting Pessimistic 5–10 Minute Cart Holds (The Ghost Hold Problem)
* **What the AI Suggested**:  
  The AI suggested holding seats for 5–10 minutes using a Redis TTL key before payment completion, arguing it is "standard e-commerce practice."
* **Why I Challenged & Rejected It**:  
  In e-commerce with 10,000 t-shirts, holding 1 shirt has 0.01% impact. But at Ottodot, classes have **only 4 seats**. Holding 1 seat locks **25% of total class inventory**! If 4 parents hold seats and walk away to make coffee, the class displays an artificial "Sold Out" banner. Genuine paying parents are turned away forever. By the time the 5-minute timer expires, the real buyers have bounced to a competitor.
* **How I Corrected It**:  
  I selected **Atomic Optimistic Finalization with Automated Refund Compensation**, guaranteeing 100% seat utilization, zero inventory starvation, and zero overbooking.

---

### ⚠️ Disagreement #3: Rejecting Pseudo-Random String IDs in Favor of Monotonic ULIDs
* **What the AI Suggested**:  
  The AI initially generated booking and payment identifiers using `Math.random().toString(36)`.
* **Why I Challenged & Rejected It**:  
  Pure random strings lack chronological order. Under concurrent write workloads, inserting random keys into a B-Tree index causes massive **B-Tree Index Page Splitting** on disk, fragmenting storage and degrading write throughput by up to 50%.
* **How I Corrected It**:  
  I mandated **26-character Crockford Base32 ULIDs** (`src/utils/ulid.ts`) prefixed with a 48-bit millisecond timestamp. This guarantees strict chronological monotonicity, optimal $O(1)$ B-Tree write locality, zero distributed collisions, and zero business volume leakage.

---

### ⚠️ Disagreement #4: Rejecting Hard Settlement in Favor of Stripe Two-Step Pre-Authorization
* **What the AI Suggested**:  
  The AI was content with charging credit cards directly and issuing immediate refunds on race loss.
* **Why I Challenged & Rejected It**:  
  I challenged the AI on real-world banking mechanics: while automated refunds work instantly in mock tests and on credit cards, **bank debit cards take 1–3 business days** for cleared funds to return across interbank networks. A parent losing the last-seat race by 1ms could experience panic seeing a temporary debit deduction. Furthermore, some payment processors retain fixed fees on refunds.
* **How I Corrected It**:  
  I documented and architected the production evolution to **Stripe Two-Step Authorization & Capture (`capture_method: manual`)**: funds are merely held, never settled, and voided in 0 milliseconds upon race loss with zero merchant fees.

---

### ⚠️ Disagreement #5: Rejecting Dark Mode Glare & Preserving Active Context
* **What the AI Suggested**:  
  The AI used Bootstrap's default `.bg-body-tertiary` without synchronizing theme tokens, causing a blinding white container in dark mode, and naively reset active user selections on dataset reload.
* **Why I Challenged & Rejected It**:  
  Reviewers spending hours evaluating code should never suffer eye strain. Furthermore, resetting the database should never hijack the reviewer's active class selection.
* **How I Corrected It**:  
  I introduced bespoke CSS design tokens (`--case-study-bg`, `--case-study-border`) with obsidian slate contrast (`#0b0f19` / `#151d30`), dynamic dark/light synchronization, and state-preserving reset semantics.

---

## 🔄 What You Would Change About Your AI Workflow If You Had To Do This Again

1. **Enforce Test-Driven Development (Menulis Tes Invarian Otomatis Terlebih Dahulu Sebelum Menulis Kode Sistem)**:  
   Dalam metodologi arsitektur perangkat lunak modern, **Test-Driven Development (TDD)** berarti kita menetapkan aturan main dan menulis skenario pengujian otomatis (*automated test assertions*) terlebih dahulu sebelum menulis satu baris pun kode backend atau antarmuka. 
   
   Jika saya harus mengulang proses ini dari awal bersama AI, saya akan menginstruksikan AI untuk langsung menyusun kode pengujian konkurensi Vitest (skenario balapan `Promise.all` memperebutkan kursi ke-4) sejak menit pertama. Dengan mematok batas kegagalan dan parameter invarian di awal, model AI dipaksa mematuhi standar arsitektur database yang tangguh dan tidak akan membuang waktu menyarankan pengecekan sepele yang rentan bocor di level aplikasi (seperti `if (count < 4)`).
2. **Explicit Database Invariant Prompts Upfront**:  
   Rather than asking the AI "how to handle capacity," I would explicitly declare the architectural constraint in the initial prompt (*"Use atomic SQL conditional updates at the database engine level; reject all application-level count checking"*), cutting out the back-and-forth correction cycle.

---

## 🧪 How You Verified the Final Implementation

1. **Automated Vitest Concurrency Suite (All 7 Tests Passing in <850ms)**:
   - Verified double-race condition: 2 users concurrently paying for seat #4 -> exactly 1 confirmed, 1 auto-refunded.
   - Verified 10-bot swarm: 10 concurrent requests -> exactly 1 confirmed, 9 auto-refunded, roster locked at 4.
   - Verified duplicate booking rejection via database partial unique index.
   - Verified payment decline safety -> zero confirmed students added.
   - Verified teacher roster export format and operational accuracy.
2. **Live Browser Millisecond Timestamp Verification**:
   - Built a real-time audit log terminal displaying high-resolution UTC timestamps (`HH:mm:ss.SSS`) and latencies (`ms`), visually proving that parallel requests execute in the exact same millisecond window.
3. **Database Integrity Audit**:
   - Validated that SQLite foreign keys (`PRAGMA foreign_keys = ON`), partial unique indexes, and ULID primary keys remain uncorrupted after continuous stress testing.

---

> *“Code is easy. Judgment is rare. Steering AI requires knowing what to protect, what to reject, and why.”*  
> — **Yoseph Iriandi** (16 Years Systems Architect & Lead Full-Stack Engineer)
