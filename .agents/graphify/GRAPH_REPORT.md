# Ottodot Architectural Knowledge Graph Report

## System Overview
The Ottodot Trial Booking system is a high-reliability, zero-overbooking transactional engine built to manage online live classes capped strictly at **4 students per class**.

## Core Domain Entities (Indexed via Monotonic ULID Primary Keys - No AUTO_INCREMENT)
- **Database File**: `ottodot_trial.sqlite` (SQLite 3 WAL Mode, `foreign_keys = ON`).
- **ULID Utility**: `src/utils/ulid.ts` generating 26-char Crockford Base32 monotonic identifiers.

- **Parents (`parents`)**: Parent accounts with unique email and contact info.
- **Students (`students`)**: Children profiles tied to a parent.
- **Trial Classes (`trial_classes`)**: Class sessions with hard-coded capacity (4) and live `confirmed_count`.
- **Bookings (`bookings`)**: Transactional state machine with partial unique index on `(trial_class_id, student_id)`.
- **Payment Attempts (`payment_attempts`)**: Audit ledger of transactions (pending, succeeded, failed, refunded) with idempotency keys.

## Service Map & Concurrency Boundaries
1. `BookingService`:
   - Step 1: Pre-validation (Early rejection).
   - Step 2: Intent creation (`pending_payment`).
   - Step 3: Payment gateway dispatch.
   - Step 4: Atomic conditional update (Seat acquisition).
   - Step 5: Compensation / Auto-refund if race lost.
2. `RosterService`:
   - Projects confirmed students ordered chronologically by `updated_at ASC`.
3. `RosterExportService`:
   - Converts rosters and analytics into token-efficient Markdown for LLM ingestion.

## Invariant Guardrails
- **Double Booking Guard**: Database partial unique index.
- **Overbooking Guard**: `UPDATE trial_classes SET confirmed_count = confirmed_count + 1 WHERE id = ? AND confirmed_count < capacity`.
- **Payment Failure Guard**: Status stays `payment_failed`; excluded from roster query.
- **Race Condition Guard**: Atomic optimistic finalization with automated refund compensation.


## UI/UX & Documentation Layer
- **Interactive Single-Page Dashboard (`public/index.html`)**:
  - `ConcurrencyLab`: Top panel managing automated 2-user race tests and 10-user rush hour spikes.
  - `TeacherView`: Live class session table & confirmed student roster with 1-click RosterExport export.
  - `ParentView`: Interactive checkout form with dynamic smart context detection (Full class, Duplicate, Payment failure).
  - `ThemeEngine`: Dual-mode (Dark/Light) theme controller persisted in `localStorage`.
- **Documentation Endpoints (`src/server.ts`)**:
  - `/SMART_GUIDE.md`: Architect-level review guide rendered via `marked` with syntax-highlighted code.
  - `/README.md`: Complete system quickstart and architectural reference.
  - `/AI_USAGE.md`: Human-in-the-loop AI steering reflection log.
  - `/AGENTS.md`: Formal engineering constitution and non-negotiable operational rules.

## Governance & Continuous Synchronization
- **Mandatory English Rule**: 100% US/UK English across all UI elements, API responses, and docs.
- **Living Documentation Mandate**: Zero-drift rule requiring all architectural updates to be synchronized across documentation in the same commit.
