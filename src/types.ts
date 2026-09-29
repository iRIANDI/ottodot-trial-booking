export type BookingStatus = 
  | 'pending_payment'
  | 'confirmed'
  | 'payment_failed'
  | 'rejected_class_full';

export type PaymentStatus = 
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded';

export interface Parent {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Student {
  id: string;
  parent_id: string;
  name: string;
  age: number;
  created_at: string;
}

export interface TrialClass {
  id: string;
  title: string;
  subject: 'Math' | 'Science';
  scheduled_at: string;
  capacity: number; // Strictly 4
  confirmed_count: number;
  created_at: string;
}

export interface Booking {
  id: string;
  trial_class_id: string;
  student_id: string;
  parent_id: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  booking_id: string;
  amount_cents: number;
  status: PaymentStatus;
  idempotency_key: string;
  failure_reason?: string | null;
  created_at: string;
}

export interface BookingSubmissionInput {
  trial_class_id: string;
  student_id: string;
  parent_id: string;
  payment_token?: 'tok_success' | 'tok_declined' | 'tok_error';
  idempotency_key?: string;
}

export interface BookingResult {
  success: boolean;
  booking_id: string;
  status: BookingStatus;
  message: string;
  payment_status: PaymentStatus;
  refund_issued?: boolean;
  trial_class_id: string;
  student_id: string;
}

export interface ClassRosterStudent {
  booking_id: string;
  student_id: string;
  student_name: string;
  student_age: number;
  parent_name: string;
  parent_email: string;
  confirmed_at: string;
}

export interface ClassRoster {
  trial_class: TrialClass;
  confirmed_students: ClassRosterStudent[];
  total_confirmed: number;
  available_seats: number;
}
