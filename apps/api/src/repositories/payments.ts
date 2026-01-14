import { randomUUID } from 'crypto';
import type { Payment, PaymentEvent } from '@soulforge/shared';
import { getConfig } from '../config.js';

// In-memory storage for POC - will be replaced with DB in T-0201
const paymentsStore: Payment[] = [];

export interface CreatePaymentInput {
  moduleId: string;
  payerWallet: string;
  payTo: string;
  value: string;
  txHash: string | null;
  event: PaymentEvent;
  error: string | null;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const config = getConfig();
  const payment: Payment = {
    id: randomUUID(),
    moduleId: input.moduleId,
    payerWallet: input.payerWallet,
    payTo: input.payTo,
    value: input.value,
    txHash: input.txHash,
    network: config.X402_NETWORK,
    event: input.event,
    error: input.error,
    createdAt: new Date(),
  };

  paymentsStore.push(payment);
  return payment;
}

export async function getPayments(): Promise<Payment[]> {
  return [...paymentsStore];
}

export async function getPaymentsByModule(moduleId: string): Promise<Payment[]> {
  return paymentsStore.filter((p) => p.moduleId === moduleId);
}

export async function clearPayments(): Promise<void> {
  paymentsStore.length = 0;
}
