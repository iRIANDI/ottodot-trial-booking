import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initSchema } from '../src/db/database';
import { runSeed } from '../src/db/seed';
import { BookingService } from '../src/services/booking-service';
import { RosterService } from '../src/services/roster-service';
import { RosterExportService } from '../src/utils/roster-export';

describe('Ottodot Trial Booking Invariant Test Suite', () => {
  let db: Database.Database;
  let bookingService: BookingService;
  let rosterService: RosterService;

  beforeEach(() => {
    // In-memory isolated database for pure, sub-second test execution
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runSeed(db);
    bookingService = new BookingService(db);
    rosterService = new RosterService(db);
  });

  it('1. should allow a parent to successfully book an available trial class', async () => {
    const result = await bookingService.bookTrialClass({
      trial_class_id: 'tc_available',
      student_id: 's_maya',
      parent_id: 'p_david',
      payment_token: 'tok_success',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('confirmed');
    expect(result.payment_status).toBe('succeeded');

    const roster = rosterService.getClassRoster('tc_available');
    expect(roster.total_confirmed).toBe(2);
    expect(roster.available_seats).toBe(2);
    expect(roster.confirmed_students.some(s => s.student_name === 'Maya Tan')).toBe(true);
  });

  it('2. should prevent duplicate confirmed bookings for the same child and class', async () => {
    // Student 's_leo' is already booked in tc_available
    const result = await bookingService.bookTrialClass({
      trial_class_id: 'tc_available',
      student_id: 's_leo',
      parent_id: 'p_sarah',
      payment_token: 'tok_success',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('already booked and confirmed');

    const roster = rosterService.getClassRoster('tc_available');
    expect(roster.total_confirmed).toBe(1); // Count did not increase
  });

  it('3. should handle payment failure without adding child to confirmed roster', async () => {
    const result = await bookingService.bookTrialClass({
      trial_class_id: 'tc_available',
      student_id: 's_chloe',
      parent_id: 'p_rachel',
      payment_token: 'tok_declined', // Trigger simulated card decline
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('payment_failed');
    expect(result.payment_status).toBe('failed');
    expect(result.message).toContain('Card declined');

    const roster = rosterService.getClassRoster('tc_available');
    expect(roster.total_confirmed).toBe(1);
    expect(roster.confirmed_students.some(s => s.student_name === 'Chloe Green')).toBe(false);
  });

  it('4. should prevent overbooking beyond 4 confirmed students', async () => {
    // tc_full already has 4 confirmed students
    const result = await bookingService.bookTrialClass({
      trial_class_id: 'tc_full',
      student_id: 's_chloe',
      parent_id: 'p_rachel',
      payment_token: 'tok_success',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('rejected_class_full');
    expect(result.message).toContain('fully booked (maximum 4 students)');

    const roster = rosterService.getClassRoster('tc_full');
    expect(roster.total_confirmed).toBe(4);
    expect(roster.available_seats).toBe(0);
  });

  it('5. should format clean, accurate teacher roster export ready for class operations', () => {
    const roster = rosterService.getClassRoster('tc_race_seat');
    const md = RosterExportService.rosterToFormattedMarkdown(roster);

    expect(md).toContain('# 📋 Ottodot Class Roster: Roblox Science: Mars Rover Physics');
    expect(md).toContain('**Leo Jenkins**');
    expect(md).toContain('**Maya Tan**');
    expect(md).toContain('**Ethan Wong**');
    expect(md).toContain('**Capacity:** 4 Students');
  });
});
