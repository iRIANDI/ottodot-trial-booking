# The Ponytail Protocol: Senior Developer Decision Ladder & Token Conservation
*Ottodot Engineering Edition • High-Reliability Booking Infrastructure*

This document defines the strict engineering protocol for AI agents, pairing assistants, and senior engineers working on this codebase. It enforces precision context budgeting, zero-bloat architecture, and mathematical correctness.

---

## 🪜 The 4-Rung Senior Developer Decision Ladder

When solving any bug, adding a feature, or handling concurrency:

### Rung 1: Native First (Database & Runtime Primitives)
- Exhaust SQLite / PostgreSQL native constraints and atomic conditional updates before writing application-level validation.
- Enforce invariants at the database kernel level:
  - Partial Unique Indexes (`idx_unique_confirmed_child_booking`) for idempotency.
  - Atomic conditional increments (`UPDATE ... WHERE confirmed_count < capacity`) for concurrency.
  - Table Check Constraints (`CHECK (confirmed_count <= capacity)`) for hard capacity boundaries.
- **Never implement in JavaScript what a single atomic SQL statement guarantees in 0.1ms.**

### Rung 2: Reuse First (Architecture & Service Boundaries)
- Consult Graphify (`.agents/graphify/graph.json`) to reuse existing service patterns:
  - `BookingService`: Transactional booking engine & state machine.
  - `MockPaymentGateway`: Deterministic payment testing & automated refund execution.
  - `RosterService`: Teacher and admin roster projection.
  - `RosterExportService`: Formats verified rosters for teacher operations.

### Rung 3: Configuration First (Declarative Invariants)
- Prefer declarative table schemas, strict TypeScript types, and deterministic status transitions over procedural `if-else` spaghetti.
- Valid Booking State Machine:
  `pending_payment` ➔ `confirmed` | `payment_failed` | `rejected_class_full`

### Rung 4: Surgical Diff
- Apply minimal, targeted diffs.
- Never rewrite entire modules when modifying business logic.
- Avoid introducing external runtime dependencies unless justified by non-functional requirements.

---

## 🎯 Token Conservation & Context Hygiene
1. **Never dump entire databases or logs**: Use targeted queries and bounded limit clauses.
2. **Context Budgeting**: Keep responses high-signal, free of sycophantic preamble, and focused on verifiable correctness.
3. **Deterministic Verification**: Verify code using automated tests (`npm test`) before declaring completion.
