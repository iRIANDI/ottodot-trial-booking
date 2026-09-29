import { ulid } from '../utils/ulid';
import { Database } from 'better-sqlite3';
import { getDatabase } from '../db/database';
import { BookingResult, BookingSubmissionInput, Booking, TrialClass } from '../types';
import { MockPaymentGateway } from './payment-service';

export class BookingService {
  private db: Database;

  constructor(customDb?: Database) {
    this.db = customDb || getDatabase();
  }

  /**
   * Main Trial Booking Workflow with Atomic Concurrency Guard
   */
  async bookTrialClass(input: BookingSubmissionInput): Promise<BookingResult> {
    const { trial_class_id, student_id, parent_id, payment_token } = input;
    const idempotencyKey = input.idempotency_key || ('idemp_' + Math.random().toString(36).substring(2, 12));
    const bookingId = ulid();
    const paymentId = ulid();
    const trialPriceCents = 2500; // $25.00 mock trial class fee

    // STEP 0: Idempotency Check (Safeguard against network retries or duplicate submits)
    if (input.idempotency_key) {
      const existingAttempt = this.db.prepare(`
        SELECT pa.*, b.status as booking_status, b.trial_class_id, b.student_id 
        FROM payment_attempts pa
        JOIN bookings b ON pa.booking_id = b.id
        WHERE pa.idempotency_key = ?
      `).get(input.idempotency_key) as any;

      if (existingAttempt) {
        return {
          success: existingAttempt.booking_status === 'confirmed',
          booking_id: existingAttempt.booking_id,
          status: existingAttempt.booking_status,
          message: 'Idempotent request: returning existing booking result without re-charging.',
          payment_status: existingAttempt.status === 'succeeded' ? 'succeeded' : 'failed',
          trial_class_id: existingAttempt.trial_class_id,
          student_id: existingAttempt.student_id,
        };
      }
    }

    // STEP 1: Fast Read Validation (Fail early if child already confirmed)
    const existingConfirmed = this.db.prepare(`
      SELECT id FROM bookings 
      WHERE trial_class_id = ? AND student_id = ? AND status = 'confirmed'
    `).get(trial_class_id, student_id) as Booking | undefined;

    if (existingConfirmed) {
      return {
        success: false,
        booking_id: existingConfirmed.id,
        status: 'confirmed',
        message: 'This child is already booked and confirmed for this trial class.',
        payment_status: 'failed',
        trial_class_id,
        student_id,
      };
    }

    // Verify class exists & has capacity
    const trialClass = this.db.prepare(`
      SELECT * FROM trial_classes WHERE id = ?
    `).get(trial_class_id) as TrialClass | undefined;

    if (!trialClass) {
      throw new Error('Trial class not found: ' + trial_class_id);
    }

    if (trialClass.confirmed_count >= trialClass.capacity) {
      return {
        success: false,
        booking_id: '',
        status: 'rejected_class_full',
        message: 'This trial class is fully booked (maximum 4 students).',
        payment_status: 'failed',
        trial_class_id,
        student_id,
      };
    }

    // STEP 2: Record Booking Intent as 'pending_payment'
    const insertBooking = this.db.prepare(`
      INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending_payment', datetime('now'), datetime('now'))
    `);
    insertBooking.run(bookingId, trial_class_id, student_id, parent_id);

    // Record initial Payment Attempt
    this.db.prepare(`
      INSERT INTO payment_attempts (id, booking_id, amount_cents, status, idempotency_key, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now'))
    `).run(paymentId, bookingId, trialPriceCents, idempotencyKey);

    // STEP 3: Execute Mock Payment Step
    const paymentResult = await MockPaymentGateway.processPayment({
      amountCents: trialPriceCents,
      paymentToken: payment_token || 'tok_success',
      idempotencyKey,
    });

    // STEP 4: Handle Payment Failure (Do NOT add student to confirmed roster)
    if (!paymentResult.success) {
      this.db.prepare(`
        UPDATE payment_attempts 
        SET status = 'failed', failure_reason = ? 
        WHERE id = ?
      `).run(paymentResult.failureReason || 'Payment declined', paymentId);

      this.db.prepare(`
        UPDATE bookings 
        SET status = 'payment_failed', updated_at = datetime('now') 
        WHERE id = ?
      `).run(bookingId);

      return {
        success: false,
        booking_id: bookingId,
        status: 'payment_failed',
        message: paymentResult.failureReason || 'Payment failed. Seat was not reserved.',
        payment_status: 'failed',
        trial_class_id,
        student_id,
      };
    }

    // STEP 5: ATOMIC FINALIZATION WITH CAPACITY INCREMENT GUARD
    // This is the core architectural solution to the Last-Seat Race Condition.
    // In SQLite/Postgres, an atomic conditional UPDATE operates as an unshakeable mutex.
    const finalizeTransaction = this.db.transaction(() => {
      // 1. Double check duplicate child booking inside transaction
      const duplicateInsideTx = this.db.prepare(`
        SELECT id FROM bookings 
        WHERE trial_class_id = ? AND student_id = ? AND status = 'confirmed'
      `).get(trial_class_id, student_id);

      if (duplicateInsideTx) {
        return {
          outcome: 'DUPLICATE_RACE',
        };
      }

      // 2. ATOMIC INCREMENT: Only increment if confirmed_count < capacity (strictly 4)
      const updateClass = this.db.prepare(`
        UPDATE trial_classes 
        SET confirmed_count = confirmed_count + 1 
        WHERE id = ? AND confirmed_count < capacity
      `);
      const updateResult = updateClass.run(trial_class_id);

      if (updateResult.changes === 0) {
        // Seat was grabbed by another user between Step 1 and Step 5!
        return {
          outcome: 'RACE_LOST_CLASS_FULL',
        };
      }

      // Seat successfully acquired!
      this.db.prepare(`
        UPDATE bookings 
        SET status = 'confirmed', updated_at = datetime('now') 
        WHERE id = ?
      `).run(bookingId);

      this.db.prepare(`
        UPDATE payment_attempts 
        SET status = 'succeeded' 
        WHERE id = ?
      `).run(paymentId);

      return {
        outcome: 'CONFIRMED',
      };
    });

    const txResult = finalizeTransaction();

    if (txResult.outcome === 'CONFIRMED') {
      return {
        success: true,
        booking_id: bookingId,
        status: 'confirmed',
        message: 'Trial class booking confirmed successfully! Welcome to Ottodot.',
        payment_status: 'succeeded',
        trial_class_id,
        student_id,
      };
    }

    // STEP 6: HANDLING RACE LOSS (AUTOMATIC COMPENSATION & REFUND)
    if (txResult.outcome === 'RACE_LOST_CLASS_FULL' || txResult.outcome === 'DUPLICATE_RACE') {
      // Automatic Instant Refund
      await MockPaymentGateway.processRefund(paymentResult.transactionId, trialPriceCents);

      this.db.prepare(`
        UPDATE payment_attempts 
        SET status = 'refunded', failure_reason = 'Class reached capacity before confirmation. Automated refund issued.' 
        WHERE id = ?
      `).run(paymentId);

      this.db.prepare(`
        UPDATE bookings 
        SET status = 'rejected_class_full', updated_at = datetime('now') 
        WHERE id = ?
      `).run(bookingId);

      return {
        success: false,
        booking_id: bookingId,
        status: 'rejected_class_full',
        message: 'Another parent completed booking for the last available seat milliseconds earlier. Your payment was automatically refunded in full ($25.00).',
        payment_status: 'refunded',
        refund_issued: true,
        trial_class_id,
        student_id,
      };
    }

    throw new Error('Unexpected booking transaction outcome: ' + txResult.outcome);
  }
}
