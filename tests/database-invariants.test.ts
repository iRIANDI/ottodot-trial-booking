import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { initSchema, getDatabase } from '../src/db/database';
import { runSeed } from '../src/db/seed';
import { BookingService } from '../src/services/booking-service';
import { RosterService } from '../src/services/roster-service';

describe('Advanced Engineering Invariant Suite: Idempotency, Hard SQL Constraints & Multi-Connection WAL', () => {
  let db: Database.Database;
  let bookingService: BookingService;
  let rosterService: RosterService;
  const tempDbPath = path.resolve(__dirname, 'test_wal_concurrent.sqlite');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runSeed(db);
    bookingService = new BookingService(db);
    rosterService = new RosterService(db);
  });

  afterEach(() => {
    // Cleanup temporary disk database files if created
    ['', '-wal', '-shm'].forEach(ext => {
      const file = tempDbPath + ext;
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (_) {}
      }
    });
  });

  it('1. IDEMPOTENCY GUARD: Network retry with the exact same idempotency_key returns cached result without double-charging or re-booking', async () => {
    const idempotencyKey = 'client_network_retry_uuid_12345';

    // First attempt: Parent David booking for Maya
    const firstResult = await bookingService.bookTrialClass({
      trial_class_id: 'tc_available',
      student_id: 's_maya',
      parent_id: 'p_david',
      payment_token: 'tok_success',
      idempotency_key: idempotencyKey,
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.status).toBe('confirmed');

    // Count confirmed students in class
    const rosterAfterFirst = rosterService.getClassRoster('tc_available');
    expect(rosterAfterFirst.total_confirmed).toBe(2);

    // Second attempt: Client connection dropped and browser retried with SAME idempotency_key
    const retryResult = await bookingService.bookTrialClass({
      trial_class_id: 'tc_available',
      student_id: 's_maya',
      parent_id: 'p_david',
      payment_token: 'tok_success',
      idempotency_key: idempotencyKey,
    });

    expect(retryResult.success).toBe(true);
    expect(retryResult.booking_id).toBe(firstResult.booking_id);
    expect(retryResult.message).toContain('Idempotent request');

    // Invariant: Total seats confirmed MUST still be 2 (NO duplicate seats allocated!)
    const rosterAfterRetry = rosterService.getClassRoster('tc_available');
    expect(rosterAfterRetry.total_confirmed).toBe(2);

    // Invariant: Exactly ONE payment attempt recorded for this idempotency key
    const paymentAttempts = db.prepare('SELECT count(*) as count FROM payment_attempts WHERE idempotency_key = ?').get(idempotencyKey) as any;
    expect(paymentAttempts.count).toBe(1);
  });

  it('2. DATABASE SCHEMA INVARIANT: Direct SQL bypass attempting duplicate confirmed booking triggers native SQLite UNIQUE constraint error', () => {
    // Student 's_leo' is already confirmed in 'tc_available'
    // Even if application logic is completely bypassed, the SQLite Partial Unique Index MUST reject it!
    expect(() => {
      db.prepare(`
        INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, created_at, updated_at)
        VALUES ('b_hack_1', 'tc_available', 's_leo', 'p_sarah', 'confirmed', datetime('now'), datetime('now'))
      `).run();
    }).toThrow(/UNIQUE constraint failed: bookings.trial_class_id, bookings.student_id/);
  });

  it('3. DATABASE SCHEMA INVARIANT: Direct SQL bypass attempting to update confirmed_count beyond capacity triggers native CHECK constraint error', () => {
    // Attempt to illegally set confirmed_count = 5 on a capacity = 4 class
    expect(() => {
      db.prepare(`
        UPDATE trial_classes 
        SET confirmed_count = 5 
        WHERE id = 'tc_full'
      `).run();
    }).toThrow(/CHECK constraint failed: confirmed_count <= capacity/);
  });

  it('4. MULTI-CONNECTION DISK WAL CONCURRENCY: Two independent database connections writing to a physical SQLite file simultaneously adhere to write locks', async () => {
    // Create actual disk-backed database with WAL mode to test OS-level kernel file locking
    const diskDb1 = new Database(tempDbPath);
    diskDb1.pragma('journal_mode = WAL');
    diskDb1.pragma('foreign_keys = ON');
    diskDb1.pragma('busy_timeout = 5000');
    initSchema(diskDb1);
    runSeed(diskDb1);

    const diskDb2 = new Database(tempDbPath);
    diskDb2.pragma('journal_mode = WAL');
    diskDb2.pragma('foreign_keys = ON');
    diskDb2.pragma('busy_timeout = 5000');

    const serviceWorker1 = new BookingService(diskDb1);
    const serviceWorker2 = new BookingService(diskDb2);

    // Both independent connection instances race for the last seat (tc_race_seat has 3/4)
    const [worker1Result, worker2Result] = await Promise.all([
      serviceWorker1.bookTrialClass({
        trial_class_id: 'tc_race_seat',
        student_id: 's_chloe',
        parent_id: 'p_rachel',
        payment_token: 'tok_success',
        idempotency_key: 'worker1_disk_race',
      }),
      serviceWorker2.bookTrialClass({
        trial_class_id: 'tc_race_seat',
        student_id: 's_noah',
        parent_id: 'p_kevin',
        payment_token: 'tok_success',
        idempotency_key: 'worker2_disk_race',
      }),
    ]);

    // Exactly 1 worker wins, exactly 1 worker is refunded
    const confirmedCount = [worker1Result, worker2Result].filter(r => r.success && r.status === 'confirmed').length;
    const refundedCount = [worker1Result, worker2Result].filter(r => !r.success && r.status === 'rejected_class_full' && r.refund_issued).length;

    expect(confirmedCount).toBe(1);
    expect(refundedCount).toBe(1);

    // Verify physical file disk state
    const finalClass = diskDb1.prepare('SELECT confirmed_count, capacity FROM trial_classes WHERE id = ?').get('tc_race_seat') as any;
    expect(finalClass.confirmed_count).toBe(4);

    diskDb1.close();
    diskDb2.close();
  });
  it('5. DYNAMIC CAPACITY SCALABILITY (N = 7): Classes with arbitrary capacity (N > 4) dynamically serialize concurrent bookings and enforce disk invariants without code changes', async () => {
    // Insert a class with capacity = 7, already filled to 6/7
    db.prepare(`
      INSERT INTO trial_classes (id, title, subject, scheduled_at, capacity, confirmed_count)
      VALUES ('tc_dynamic_n7', 'Roblox Particle Physics Masterclass', 'Science', '2026-10-15 14:00', 7, 6)
    `).run();

    // Two parents race concurrently for the 7th seat
    const [res1, res2] = await Promise.all([
      bookingService.bookTrialClass({
        trial_class_id: 'tc_dynamic_n7',
        student_id: 's_maya',
        parent_id: 'p_david',
        payment_token: 'tok_success',
        idempotency_key: 'dyn_race_1',
      }),
      bookingService.bookTrialClass({
        trial_class_id: 'tc_dynamic_n7',
        student_id: 's_noah',
        parent_id: 'p_kevin',
        payment_token: 'tok_success',
        idempotency_key: 'dyn_race_2',
      }),
    ]);

    // Exactly 1 confirmed, exactly 1 rejected & refunded
    const confirmedResults = [res1, res2].filter(r => r.success && r.status === 'confirmed');
    const rejectedResults = [res1, res2].filter(r => !r.success && r.status === 'rejected_class_full' && r.refund_issued);

    expect(confirmedResults.length).toBe(1);
    expect(rejectedResults.length).toBe(1);

    // Database state strictly 7/7
    const row = db.prepare('SELECT confirmed_count, capacity FROM trial_classes WHERE id = ?').get('tc_dynamic_n7') as any;
    expect(row.capacity).toBe(7);
    expect(row.confirmed_count).toBe(7);

    // Disk-level CHECK constraint strictly rejects manual attempt to update to 8
    expect(() => {
      db.prepare('UPDATE trial_classes SET confirmed_count = 8 WHERE id = ?').run('tc_dynamic_n7');
    }).toThrow(/CHECK constraint failed/);
  });
});
