import { Database } from 'better-sqlite3';
import { getDatabase } from '../db/database';
import { ClassRoster, TrialClass } from '../types';

export class RosterService {
  private db: Database;

  constructor(customDb?: Database) {
    this.db = customDb || getDatabase();
  }

  /**
   * Retrieves live, tamper-proof class roster for teachers & admin.
   * Only returns students with confirmed status.
   */
  getClassRoster(trialClassId: string): ClassRoster {
    const trialClass = this.db.prepare(`
      SELECT * FROM trial_classes WHERE id = ?
    `).get(trialClassId) as TrialClass | undefined;

    if (!trialClass) {
      throw new Error('Trial class not found: ' + trialClassId);
    }

    const confirmedStudents = this.db.prepare(`
      SELECT 
        b.id as booking_id,
        s.id as student_id,
        s.name as student_name,
        s.age as student_age,
        p.name as parent_name,
        p.email as parent_email,
        b.updated_at as confirmed_at
      FROM bookings b
      JOIN students s ON s.id = b.student_id
      JOIN parents p ON p.id = b.parent_id
      WHERE b.trial_class_id = ? AND b.status = 'confirmed'
      ORDER BY b.updated_at ASC
    `).all(trialClassId) as any[];

    return {
      trial_class: trialClass,
      confirmed_students: confirmedStudents,
      total_confirmed: confirmedStudents.length,
      available_seats: Math.max(0, trialClass.capacity - confirmedStudents.length),
    };
  }

  getAllClasses(): TrialClass[] {
    return this.db.prepare(`
      SELECT * FROM trial_classes ORDER BY scheduled_at ASC
    `).all() as TrialClass[];
  }
}
