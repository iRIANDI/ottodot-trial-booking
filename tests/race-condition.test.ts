import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/database';
import { runSeed } from '../src/db/seed';
import { BookingService } from '../src/services/booking-service';
import { RosterService } from '../src/services/roster-service';

describe('Required Technical Scenario: Last-Seat Race Condition & Concurrency Guards', () => {
  let db: Database.Database;
  let bookingService: BookingService;
  let rosterService: RosterService;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runSeed(db);
    bookingService = new BookingService(db);
    rosterService = new RosterService(db);
  });

  it('1. REQUIRED SCENARIO: User A and User B concurrently submit payment for the last seat (seat #4) — EXACTLY ONE confirms, ONE safely refunded', async () => {
    // tc_race_seat starts with EXACTLY 3 confirmed students (1 seat left!)
    const initialRoster = rosterService.getClassRoster('tc_race_seat');
    expect(initialRoster.total_confirmed).toBe(3);
    expect(initialRoster.available_seats).toBe(1);

    // User A: Parent Rachel booking for Chloe
    const promiseA = bookingService.bookTrialClass({
      trial_class_id: 'tc_race_seat',
      student_id: 's_chloe',
      parent_id: 'p_rachel',
      payment_token: 'tok_success',
      idempotency_key: 'race_user_a',
    });

    // User B: Parent Kevin booking for Noah
    const promiseB = bookingService.bookTrialClass({
      trial_class_id: 'tc_race_seat',
      student_id: 's_noah',
      parent_id: 'p_kevin',
      payment_token: 'tok_success',
      idempotency_key: 'race_user_b',
    });

    // Fire both concurrent requests simultaneously via Promise.all
    const [resultA, resultB] = await Promise.all([promiseA, promiseB]);

    // INVARIANT 1: Exactly ONE user must succeed
    const successCount = [resultA, resultB].filter(r => r.success && r.status === 'confirmed').length;
    expect(successCount).toBe(1);

    // INVARIANT 2: Exactly ONE user must be rejected and refunded
    const rejectedCount = [resultA, resultB].filter(r => !r.success && r.status === 'rejected_class_full' && r.refund_issued).length;
    expect(rejectedCount).toBe(1);

    // INVARIANT 3: Database confirmed count must strictly equal 4 (NEVER 5!)
    const finalRoster = rosterService.getClassRoster('tc_race_seat');
    expect(finalRoster.total_confirmed).toBe(4);
    expect(finalRoster.available_seats).toBe(0);

    // INVARIANT 4: The refunded user must have a clear customer-facing explanation
    const rejectedUser = resultA.success ? resultB : resultA;
    expect(rejectedUser.message).toContain('refunded in full');
  });

  it('2. PEAK TRAFFIC STORM: 10 concurrent parents rush the last 1 seat simultaneously — EXACTLY 1 confirms, 9 safely refunded, zero overbooking', async () => {
    // Insert 10 synthetic students and parents for mass concurrency test
    const parentStmt = db.prepare('INSERT OR IGNORE INTO parents (id, name, email) VALUES (?, ?, ?)');
    const studentStmt = db.prepare('INSERT OR IGNORE INTO students (id, parent_id, name, age) VALUES (?, ?, ?, ?)');

    for (let i = 1; i <= 10; i++) {
      parentStmt.run(`p_storm_${i}`, `Storm Parent ${i}`, `storm${i}@test.com`);
      studentStmt.run(`s_storm_${i}`, `p_storm_${i}`, `Storm Child ${i}`, 8 + (i % 4));
    }

    // Launch 10 parallel booking requests at the EXACT SAME millisecond
    const promises = Array.from({ length: 10 }, (_, i) => {
      const idx = i + 1;
      return bookingService.bookTrialClass({
        trial_class_id: 'tc_race_seat',
        student_id: `s_storm_${idx}`,
        parent_id: `p_storm_${idx}`,
        payment_token: 'tok_success',
        idempotency_key: `storm_idem_${idx}_${Date.now()}`,
      });
    });

    const results = await Promise.all(promises);

    const confirmed = results.filter(r => r.success && r.status === 'confirmed');
    const rejectedAndRefunded = results.filter(r => !r.success && r.status === 'rejected_class_full' && r.refund_issued);

    // HIGH CONCURRENCY INVARIANTS:
    expect(confirmed.length).toBe(1); // EXACTLY 1 winner
    expect(rejectedAndRefunded.length).toBe(9); // 9 losers immediately refunded

    const finalRoster = rosterService.getClassRoster('tc_race_seat');
    expect(finalRoster.total_confirmed).toBe(4); // Capped at exactly 4!
    expect(finalRoster.available_seats).toBe(0);
  });
});
