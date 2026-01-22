import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { buildPaymentRequirements, verifyPayment, settlePayment } from '../services/x402.js';
import { createPayment } from '../repositories/payments.js';

// Lowercase to avoid checksum validation issues in some clients (e.g., viem strict mixed-case checks)
const DEMO_PAY_TO = '0x742d35cc6634c0532925a3b844bc9e7595f8bbf5';
const DEMO_PRICE = '10000'; // 0.01 USDC (6 decimals)
const DEMO_MODULE_ID = 'demo-module';

interface EchoBody {
  message: string;
}

export async function premiumRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: EchoBody }>(
    '/api/premium/echo',
    async (request: FastifyRequest<{ Body: EchoBody }>, reply: FastifyReply) => {
      const paymentHeader = request.headers['x-payment'] as string | undefined;

      // No payment header -> 402
      if (!paymentHeader) {
        const requirements = buildPaymentRequirements(
          DEMO_PAY_TO,
          DEMO_PRICE,
          'premium/echo: 1 message'
        );
        return reply.status(402).send({
          error: 'Payment Required',
          paymentRequirements: requirements,
        });
      }

      // Verify payment
      const verifyResult = await verifyPayment(paymentHeader);
      if (!verifyResult.valid) {
        // Record failed verification
        await createPayment({
          moduleId: DEMO_MODULE_ID,
          payerWallet: 'unknown',
          payTo: DEMO_PAY_TO,
          value: DEMO_PRICE,
          txHash: null,
          event: 'failed',
          error: `verify: ${verifyResult.error}`,
        });

        return reply.status(402).send({
          error: 'Payment verification failed',
          details: verifyResult.error,
          paymentRequirements: buildPaymentRequirements(
            DEMO_PAY_TO,
            DEMO_PRICE,
            'premium/echo: 1 message'
          ),
        });
      }

      // Settle payment
      const settleResult = await settlePayment(paymentHeader);
      if (!settleResult.success) {
        // Record failed settlement
        await createPayment({
          moduleId: DEMO_MODULE_ID,
          payerWallet: verifyResult.payer || 'unknown',
          payTo: DEMO_PAY_TO,
          value: verifyResult.value || DEMO_PRICE,
          txHash: null,
          event: 'failed',
          error: `settle: ${settleResult.error}`,
        });

        return reply.status(402).send({
          error: 'Payment settlement failed',
          details: settleResult.error,
          paymentRequirements: buildPaymentRequirements(
            DEMO_PAY_TO,
            DEMO_PRICE,
            'premium/echo: 1 message'
          ),
        });
      }

      // Record successful payment
      const payment = await createPayment({
        moduleId: DEMO_MODULE_ID,
        payerWallet: verifyResult.payer || 'unknown',
        payTo: DEMO_PAY_TO,
        value: verifyResult.value || DEMO_PRICE,
        txHash: settleResult.txHash || null,
        event: 'settled',
        error: null,
      });

      // Return the echo response with payment info
      const body = request.body || { message: 'Hello' };
      return reply.status(200).send({
        echo: body.message,
        payment: {
          txHash: payment.txHash,
          from: payment.payerWallet,
          to: payment.payTo,
          value: payment.value,
          network: payment.network,
        },
      });
    }
  );

  // Debug endpoint to view payments (for POC testing)
  fastify.get('/api/premium/payments', async () => {
    const { getPayments } = await import('../repositories/payments.js');
    return { payments: await getPayments() };
  });
}
