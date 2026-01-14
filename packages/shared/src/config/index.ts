import { z } from 'zod';

const ApiConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url().optional(),
  API_URL: z.string().url().optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // LLM
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),

  // x402 Payment
  X402_FACILITATOR_BASE_URL: z.string().url().optional(),
  X402_NETWORK: z.string().default('base-sepolia'),
  X402_ASSET_CONTRACT: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  X402_ASSET_DECIMALS: z.coerce.number().int().default(6),
  X402_CHAIN_ID: z.coerce.number().int().optional(),
  X402_EIP712_NAME: z.string().default('x402'),
  X402_EIP712_VERSION: z.string().default('1'),
  X402_MOCK_MODE: z.coerce.boolean().default(false),

  // Security
  JWT_SECRET: z.string().min(32).optional(),
  AGENT_WALLET_ENCRYPTION_KEY: z.string().min(32).optional(),

  // Admin Bootstrap (optional - set this to auto-promote a wallet to admin on first login)
  INITIAL_ADMIN_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

const WebConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_X402_NETWORK: z.string().default('base-sepolia'),
  NEXT_PUBLIC_X402_CHAIN_ID: z.coerce.number().int().optional(),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;
export type WebConfig = z.infer<typeof WebConfigSchema>;

export class ConfigValidationError extends Error {
  constructor(public issues: string[]) {
    super(`Invalid configuration:\n${issues.join('\n')}`);
    this.name = 'ConfigValidationError';
  }
}

export function validateApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const result = ApiConfigSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );
    throw new ConfigValidationError(errors);
  }
  return result.data;
}

export function validateWebConfig(env: Record<string, string | undefined>): WebConfig {
  const result = WebConfigSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );
    throw new ConfigValidationError(errors);
  }
  return result.data;
}

export { ApiConfigSchema, WebConfigSchema };
