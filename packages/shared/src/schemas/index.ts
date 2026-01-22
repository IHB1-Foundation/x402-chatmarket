import { z } from 'zod';

export const UserRoleSchema = z.enum(['buyer', 'seller', 'admin']);

export const ModuleTypeSchema = z.enum(['base', 'remix']);

export const ModuleStatusSchema = z.enum(['draft', 'published', 'blocked']);

export const PricingModeSchema = z.enum(['per_message', 'per_session']);

export const SessionPolicySchema = z.object({
  minutes: z.number().int().positive(),
  messageCredits: z.number().int().positive(),
});

export const RemixPolicySchema = z.object({
  deltaPersona: z.string(),
  upstreamWeight: z.number().min(0).max(1),
});

export const ChatRequestSchema = z.object({
  chatId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

export const PaymentRequirementsSchema = z.object({
  scheme: z.literal('exact'),
  network: z.string(),
  payTo: z.string(),
  asset: z.string(),
  description: z.string(),
  mimeType: z.string(),
  maxAmountRequired: z.string(),
  maxTimeoutSeconds: z.number().int().positive(),
});

export const CreateModuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  tags: z.array(z.string().max(50)).max(10),
  personaPrompt: z.string().min(1).max(10000),
  pricingMode: PricingModeSchema,
  priceAmount: z.string().regex(/^\d+$/, 'Must be integer string in smallest units'),
  sessionPolicy: SessionPolicySchema.nullable().optional(),
  payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address'),
});

export const ModuleDocumentInputSchema = z.object({
  sourceType: z.enum(['qa', 'doc']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
});

export type ChatRequestInput = z.infer<typeof ChatRequestSchema>;
export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type ModuleDocumentInput = z.infer<typeof ModuleDocumentInputSchema>;
