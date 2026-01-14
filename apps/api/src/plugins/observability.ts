import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';

// Extend FastifyRequest to include requestId
declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    startTime: number;
  }
}

/**
 * Observability plugin that adds:
 * - Request ID generation and tracking
 * - Request/response logging with latency
 * - Structured log format for payment events
 */
export async function observabilityPlugin(fastify: FastifyInstance): Promise<void> {
  // Add request ID and start time to every request
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.requestId = (request.headers['x-request-id'] as string) || randomUUID();
    request.startTime = Date.now();

    // Log incoming request
    request.log.info({
      type: 'request_start',
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    });
  });

  // Log response with latency
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const latencyMs = Date.now() - request.startTime;

    request.log.info({
      type: 'request_end',
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      latencyMs,
    });
  });

  // Log errors
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error({
      type: 'request_error',
      requestId: request.requestId,
      method: request.method,
      url: request.url,
      error: error.message,
      stack: error.stack,
    });
  });
}

/**
 * Structured logger for payment events.
 * Call this from payment handling code to log payment-specific events.
 */
export interface PaymentLogEvent {
  type: 'payment_attempt' | 'payment_verify' | 'payment_settle' | 'payment_success' | 'payment_failure';
  requestId: string;
  moduleId?: string;
  payer?: string;
  payTo?: string;
  value?: string;
  txHash?: string;
  network?: string;
  error?: string;
  latencyMs?: number;
}

export function logPaymentEvent(
  request: FastifyRequest,
  event: Omit<PaymentLogEvent, 'requestId'>
): void {
  request.log.info({
    ...event,
    requestId: request.requestId,
  });
}

/**
 * Log a payment attempt start
 */
export function logPaymentAttempt(
  request: FastifyRequest,
  details: { moduleId: string; payer?: string; value?: string }
): void {
  logPaymentEvent(request, {
    type: 'payment_attempt',
    ...details,
  });
}

/**
 * Log payment verification result
 */
export function logPaymentVerify(
  request: FastifyRequest,
  details: { moduleId: string; payer?: string; valid: boolean; error?: string; latencyMs?: number }
): void {
  logPaymentEvent(request, {
    type: 'payment_verify',
    moduleId: details.moduleId,
    payer: details.payer,
    error: details.valid ? undefined : details.error,
    latencyMs: details.latencyMs,
  });
}

/**
 * Log payment settlement result
 */
export function logPaymentSettle(
  request: FastifyRequest,
  details: {
    moduleId: string;
    payer?: string;
    payTo?: string;
    value?: string;
    success: boolean;
    txHash?: string;
    network?: string;
    error?: string;
    latencyMs?: number;
  }
): void {
  const eventType = details.success ? 'payment_success' : 'payment_failure';

  logPaymentEvent(request, {
    type: eventType,
    moduleId: details.moduleId,
    payer: details.payer,
    payTo: details.payTo,
    value: details.value,
    txHash: details.txHash,
    network: details.network,
    error: details.success ? undefined : details.error,
    latencyMs: details.latencyMs,
  });
}
