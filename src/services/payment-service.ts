export interface ProcessPaymentOptions {
  amountCents: number;
  paymentToken?: string;
  idempotencyKey: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  transactionId: string;
  failureReason?: string;
}

/**
 * Deterministic Mock Payment Gateway
 * Supports tokens:
 * - 'tok_success' (default): Simulates 200ms latency, returns success.
 * - 'tok_declined': Simulates card decline / insufficient funds.
 * - 'tok_error': Simulates payment provider gateway timeout.
 */
export class MockPaymentGateway {
  static async processPayment(options: ProcessPaymentOptions): Promise<PaymentGatewayResponse> {
    const token = options.paymentToken || 'tok_success';
    const txId = 'tx_' + Math.random().toString(36).substring(2, 10);

    // Optional simulated network delay
    await new Promise((resolve) => setTimeout(resolve, 30));

    if (token === 'tok_declined') {
      return {
        success: false,
        transactionId: txId,
        failureReason: 'Card declined: Insufficient funds or invalid CVV.',
      };
    }

    if (token === 'tok_error') {
      return {
        success: false,
        transactionId: txId,
        failureReason: 'Payment gateway timeout. Please retry.',
      };
    }

    return {
      success: true,
      transactionId: txId,
    };
  }

  static async processRefund(transactionId: string, amountCents: number): Promise<{ success: boolean; refundId: string }> {
    return {
      success: true,
      refundId: 'ref_' + Math.random().toString(36).substring(2, 10),
    };
  }
}
