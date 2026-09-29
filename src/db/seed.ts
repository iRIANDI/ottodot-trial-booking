import { getDatabase } from './database';
import { ulid } from '../utils/ulid';

export function runSeed(customDb?: any) {
  const db = (customDb && typeof customDb.exec === 'function') ? customDb : getDatabase(typeof customDb === 'string' ? customDb : undefined);

  // Clear existing records
  db.exec(`
    DELETE FROM payment_attempts;
    DELETE FROM bookings;
    DELETE FROM students;
    DELETE FROM parents;
    DELETE FROM trial_classes;
  `);

  console.log('Seeding Ottodot Synthetic Dataset...');

  // 1. Insert Parents
  const insertParent = db.prepare('INSERT INTO parents (id, name, email) VALUES (?, ?, ?)');
  insertParent.run('p_sarah', 'Sarah Jenkins', 'sarah.j@example.com');
  insertParent.run('p_david', 'David Tan', 'david.tan@example.com');
  insertParent.run('p_emily', 'Emily Wong', 'emily.w@example.com');
  insertParent.run('p_marcus', 'Marcus Lim', 'marcus.l@example.com');
  insertParent.run('p_rachel', 'Rachel Green', 'rachel.g@example.com');
  insertParent.run('p_kevin', 'Kevin Zhao', 'kevin.z@example.com');

  // 2. Insert Students
  const insertStudent = db.prepare('INSERT INTO students (id, parent_id, name, age) VALUES (?, ?, ?, ?)');
  insertStudent.run('s_leo', 'p_sarah', 'Leo Jenkins', 9);
  insertStudent.run('s_maya', 'p_david', 'Maya Tan', 10);
  insertStudent.run('s_ethan', 'p_emily', 'Ethan Wong', 8);
  insertStudent.run('s_lucas', 'p_marcus', 'Lucas Lim', 11);
  insertStudent.run('s_chloe', 'p_rachel', 'Chloe Green', 9);
  insertStudent.run('s_noah', 'p_kevin', 'Noah Zhao', 10);

  // 3. Insert Trial Classes (Covering all 4 required testing scenarios)
  const insertClass = db.prepare(`
    INSERT INTO trial_classes (id, title, subject, scheduled_at, capacity, confirmed_count) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Case 1: Available Class (1 confirmed, 3 available seats)
  insertClass.run('tc_available', 'Roblox Math: Multiplication Volcano', 'Math', 'Tomorrow, 4:00 PM SGT', 4, 1);
  
  // Case 2: Last-Seat Race Class (Exactly 3 confirmed students, 1 seat remaining!)
  insertClass.run('tc_race_seat', 'Roblox Science: Mars Rover Physics', 'Science', 'Saturday, 10:00 AM SGT', 4, 3);
  
  // Case 3: Fully Booked Class (4 confirmed, 0 seats remaining)
  insertClass.run('tc_full', 'Roblox Math: Geometry Castle Defense', 'Math', 'Sunday, 2:00 PM SGT', 4, 4);

  // 4. Pre-populate existing confirmed bookings with true 26-character ULIDs
  const insertBooking = db.prepare(`
    INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, created_at, updated_at) 
    VALUES (?, ?, ?, ?, 'confirmed', datetime('now'), datetime('now'))
  `);
  const insertPayment = db.prepare(`
    INSERT INTO payment_attempts (id, booking_id, amount_cents, status, idempotency_key, created_at)
    VALUES (?, ?, ?, 'succeeded', ?, datetime('now'))
  `);

  // tc_available: 1 student (Leo)
  const bk1 = ulid();
  insertBooking.run(bk1, 'tc_available', 's_leo', 'p_sarah');
  insertPayment.run(ulid(), bk1, 2500, 'idemp_init_1');

  // tc_race_seat: 3 students (Leo, Maya, Ethan) -> exactly 1 seat left for race condition testing!
  const bk2 = ulid();
  insertBooking.run(bk2, 'tc_race_seat', 's_leo', 'p_sarah');
  insertPayment.run(ulid(), bk2, 2500, 'idemp_init_2');

  const bk3 = ulid();
  insertBooking.run(bk3, 'tc_race_seat', 's_maya', 'p_david');
  insertPayment.run(ulid(), bk3, 2500, 'idemp_init_3');

  const bk4 = ulid();
  insertBooking.run(bk4, 'tc_race_seat', 's_ethan', 'p_emily');
  insertPayment.run(ulid(), bk4, 2500, 'idemp_init_4');

  // tc_full: 4 students (Leo, Maya, Ethan, Lucas)
  const bk5 = ulid();
  insertBooking.run(bk5, 'tc_full', 's_leo', 'p_sarah');
  insertPayment.run(ulid(), bk5, 2500, 'idemp_init_5');

  const bk6 = ulid();
  insertBooking.run(bk6, 'tc_full', 's_maya', 'p_david');
  insertPayment.run(ulid(), bk6, 2500, 'idemp_init_6');

  const bk7 = ulid();
  insertBooking.run(bk7, 'tc_full', 's_ethan', 'p_emily');
  insertPayment.run(ulid(), bk7, 2500, 'idemp_init_7');

  const bk8 = ulid();
  insertBooking.run(bk8, 'tc_full', 's_lucas', 'p_marcus');
  insertPayment.run(ulid(), bk8, 2500, 'idemp_init_8');

  console.log('Seed completed successfully with 26-character ULIDs!');
}

if (require.main === module) {
  runSeed();
}
