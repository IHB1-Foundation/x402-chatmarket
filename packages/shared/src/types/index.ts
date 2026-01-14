export type UserRole = 'buyer' | 'seller' | 'admin';

export type ModuleType = 'base' | 'remix';

export type ModuleStatus = 'draft' | 'published' | 'blocked';

export type PricingMode = 'per_message' | 'per_session';

export type PaymentEvent = 'settled' | 'failed';

export interface User {
  id: string;
  walletAddress: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface Module {
  id: string;
  ownerUserId: string;
  type: ModuleType;
  name: string;
  description: string;
  tags: string[];
  status: ModuleStatus;
  personaPrompt: string;
  pricingMode: PricingMode;
  priceAmount: string;
  sessionPolicy: SessionPolicy | null;
  payTo: string;
  network: string;
  assetContract: string;
  upstreamModuleId: string | null;
  remixPolicy: RemixPolicy | null;
  evalScore: number | null;
  lastEvalAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionPolicy {
  minutes: number;
  messageCredits: number;
}

export interface RemixPolicy {
  deltaPersona: string;
  upstreamWeight: number;
}

export interface ModuleDocument {
  id: string;
  moduleId: string;
  sourceType: 'qa' | 'doc';
  title: string;
  content: string;
  embedding: number[] | null;
  createdAt: Date;
}

export interface Chat {
  id: string;
  moduleId: string;
  walletAddress: string | null;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokenUsage: TokenUsage | null;
  createdAt: Date;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Payment {
  id: string;
  moduleId: string;
  payerWallet: string;
  payTo: string;
  value: string;
  txHash: string | null;
  network: string;
  event: PaymentEvent;
  error: string | null;
  createdAt: Date;
}

export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  payTo: string;
  asset: string;
  description: string;
  mimeType: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
}

export interface ChatRequest {
  chatId?: string;
  message: string;
}

export interface ChatResponse {
  chatId: string;
  reply: string;
  payment?: {
    txHash: string;
    from: string;
    to: string;
    value: string;
    network: string;
  };
}
