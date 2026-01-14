import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getPool } from '../lib/db.js';
import { buildPaymentRequirements, verifyPayment, settlePayment } from '../services/x402.js';
import { executeRAG } from '../services/rag.js';
import {
  checkTryOnceEligible,
  recordTryOnceUsage,
  truncateForTryOnce,
  TRY_ONCE_LIMITS,
} from '../services/try-once.js';
import {
  issueSessionPass,
  validateSessionPass,
  consumeSessionCredit,
  supportsSessionPass,
  type SessionPolicy,
  type SessionPassInfo,
} from '../services/session-pass.js';

const ChatRequestSchema = z.object({
  chatId: z.string().uuid().optional().nullable(),
  message: z.string().min(1).max(4000),
  mode: z.enum(['try', 'paid']).optional(), // 'try' for free preview, 'paid' for payment flow
});

type ChatRequest = z.infer<typeof ChatRequestSchema>;

interface ModuleInfo {
  id: string;
  name: string;
  status: string;
  payTo: string;
  priceAmount: string;
  pricingMode: string;
  sessionPolicy: SessionPolicy | null;
  network: string;
  assetContract: string;
}

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  // Chat endpoint for modules
  fastify.post<{ Params: { id: string }; Body: ChatRequest }>(
    '/api/modules/:id/chat',
    async (request: FastifyRequest<{ Params: { id: string }; Body: ChatRequest }>, reply: FastifyReply) => {
      const { id } = request.params;
      const pool = getPool();

      // Parse request
      const parseResult = ChatRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: parseResult.error.issues,
        });
      }

      const { chatId, message, mode } = parseResult.data;

      // Fetch module
      const moduleResult = await pool.query(
        `SELECT id, name, status, pay_to, price_amount, pricing_mode, session_policy, network, asset_contract
         FROM modules WHERE id = $1`,
        [id]
      );

      if (moduleResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Module not found' });
      }

      const module: ModuleInfo = {
        id: moduleResult.rows[0].id,
        name: moduleResult.rows[0].name,
        status: moduleResult.rows[0].status,
        payTo: moduleResult.rows[0].pay_to,
        priceAmount: moduleResult.rows[0].price_amount,
        pricingMode: moduleResult.rows[0].pricing_mode,
        sessionPolicy: moduleResult.rows[0].session_policy as SessionPolicy | null,
        network: moduleResult.rows[0].network,
        assetContract: moduleResult.rows[0].asset_contract,
      };

      // Only allow chat with published modules
      if (module.status !== 'published') {
        return reply.status(404).send({ error: 'Module not available' });
      }

      // Get client identifiers for try-once check
      const clientIp = request.ip;
      const walletAddress = request.headers['x-wallet-address'] as string | undefined;

      // Check for session pass (skip payment if valid)
      const sessionPassHeader = request.headers['x-session-pass'] as string | undefined;
      if (sessionPassHeader) {
        const sessionPassResult = await validateSessionPass(sessionPassHeader);

        if (sessionPassResult.valid && sessionPassResult.payload) {
          // Verify session pass is for this module
          if (sessionPassResult.payload.moduleId !== id) {
            return reply.status(403).send({
              error: 'Session pass not valid for this module',
            });
          }

          // Consume a credit
          const { creditsRemaining } = await consumeSessionCredit({
            moduleId: id,
            walletAddress: sessionPassResult.payload.sub,
            paymentTxHash: sessionPassResult.payload.paymentTxHash,
          });

          // Execute RAG with session pass (full response, no limits)
          try {
            let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
            if (chatId) {
              const historyResult = await pool.query(
                `SELECT role, content FROM chat_messages
                 WHERE chat_id = $1 AND role IN ('user', 'assistant')
                 ORDER BY created_at DESC LIMIT 10`,
                [chatId]
              );
              if (historyResult.rows.length > 0) {
                chatHistory = historyResult.rows
                  .reverse()
                  .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
              }
            }

            const ragResult = await executeRAG({
              moduleId: id,
              userMessage: message,
              chatHistory,
            });

            // Create or get chat
            const chatResult = await getOrCreateChat(pool, chatId, id, sessionPassResult.payload.sub);

            // Save messages
            await saveMessage(pool, chatResult.id, 'user', message);
            await saveMessage(pool, chatResult.id, 'assistant', ragResult.reply, ragResult.usage);

            return reply.send({
              chatId: chatResult.id,
              reply: ragResult.reply,
              sessionPass: {
                creditsRemaining,
                expiresAt: sessionPassResult.payload.expiresAt,
              },
            });
          } catch (err) {
            fastify.log.error(err, 'Failed to execute RAG with session pass');
            return reply.status(500).send({ error: 'Failed to generate response' });
          }
        } else {
          // Session pass invalid/expired/exhausted - fall through to payment flow
          // but inform client about session pass status
          fastify.log.info({ error: sessionPassResult.error }, 'Session pass invalid, requiring payment');
        }
      }

      // Check for free try eligibility
      if (mode === 'try' || !request.headers['x-payment']) {
        const eligibility = await checkTryOnceEligible({
          moduleId: id,
          walletAddress,
          ipAddress: clientIp,
        });

        if (eligibility.eligible) {
          // Execute free try
          try {
            const ragResult = await executeRAG({
              moduleId: id,
              userMessage: message,
              maxContextDocs: 3, // Fewer docs for free try
            });

            // Record usage
            await recordTryOnceUsage({
              moduleId: id,
              walletAddress,
              ipAddress: clientIp,
            });

            // Truncate response for free preview
            const truncatedReply = truncateForTryOnce(ragResult.reply);

            // Create or get chat
            const chatResult = await getOrCreateChat(pool, chatId, id, walletAddress);

            // Save messages
            await saveMessage(pool, chatResult.id, 'user', message);
            await saveMessage(pool, chatResult.id, 'assistant', truncatedReply, ragResult.usage);

            return reply.send({
              chatId: chatResult.id,
              reply: truncatedReply,
              isTryOnce: true,
              message: 'This is a free preview. Pay to unlock full responses.',
            });
          } catch (err) {
            fastify.log.error(err, 'Failed to execute free try');
            return reply.status(500).send({ error: 'Failed to generate response' });
          }
        }

        // Not eligible for free try and no payment - return 402
        if (!request.headers['x-payment']) {
          const paymentRequirements = buildPaymentRequirements(
            module.payTo,
            module.priceAmount,
            `module:${module.id} / 1 ${module.pricingMode === 'per_message' ? 'message' : 'session'}`
          );

          const response402: {
            error: string;
            paymentRequirements: ReturnType<typeof buildPaymentRequirements>;
            tryOnceUsed: boolean;
            tryOnceUsedAt?: string;
            sessionPassSupported?: boolean;
            sessionPolicy?: SessionPolicy;
          } = {
            error: 'Payment Required',
            paymentRequirements,
            tryOnceUsed: true,
            tryOnceUsedAt: eligibility.usedAt,
          };

          // Indicate session pass support
          if (supportsSessionPass(module.pricingMode, module.sessionPolicy) && module.sessionPolicy) {
            response402.sessionPassSupported = true;
            response402.sessionPolicy = module.sessionPolicy;
          }

          return reply.status(402).send(response402);
        }
      }

      // Process payment
      const paymentHeader = request.headers['x-payment'] as string;

      // Verify payment
      const verifyResult = await verifyPayment(paymentHeader);
      if (!verifyResult.valid) {
        // Record failed payment attempt
        await recordPayment(pool, {
          moduleId: id,
          payerWallet: verifyResult.payer || 'unknown',
          payTo: module.payTo,
          value: verifyResult.value || module.priceAmount,
          network: module.network,
          event: 'failed',
          error: verifyResult.error,
        });

        return reply.status(402).send({
          error: 'Payment verification failed',
          details: verifyResult.error,
        });
      }

      // Settle payment
      const settleResult = await settlePayment(paymentHeader);
      if (!settleResult.success) {
        // Record failed settlement
        await recordPayment(pool, {
          moduleId: id,
          payerWallet: verifyResult.payer || 'unknown',
          payTo: module.payTo,
          value: verifyResult.value || module.priceAmount,
          network: module.network,
          event: 'failed',
          error: settleResult.error,
        });

        return reply.status(402).send({
          error: 'Payment settlement failed',
          details: settleResult.error,
        });
      }

      // Record successful payment
      await recordPayment(pool, {
        moduleId: id,
        payerWallet: verifyResult.payer || 'unknown',
        payTo: module.payTo,
        value: verifyResult.value || module.priceAmount,
        txHash: settleResult.txHash,
        network: module.network,
        event: 'settled',
      });

      // Execute RAG and generate response
      try {
        // Get chat history if chatId provided
        let chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
        if (chatId) {
          const historyResult = await pool.query(
            `SELECT role, content FROM chat_messages
             WHERE chat_id = $1 AND role IN ('user', 'assistant')
             ORDER BY created_at DESC LIMIT 10`,
            [chatId]
          );
          if (historyResult.rows.length > 0) {
            chatHistory = historyResult.rows
              .reverse()
              .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
          }
        }

        const ragResult = await executeRAG({
          moduleId: id,
          userMessage: message,
          chatHistory,
        });

        // Create or get chat
        const chatResult = await getOrCreateChat(pool, chatId, id, verifyResult.payer);

        // Save messages
        await saveMessage(pool, chatResult.id, 'user', message);
        await saveMessage(pool, chatResult.id, 'assistant', ragResult.reply, ragResult.usage);

        // Build response
        const response: {
          chatId: string;
          reply: string;
          payment: {
            txHash: string | undefined;
            from: string | undefined;
            to: string;
            value: string;
            network: string;
          };
          sessionPass?: SessionPassInfo;
        } = {
          chatId: chatResult.id,
          reply: ragResult.reply,
          payment: {
            txHash: settleResult.txHash,
            from: verifyResult.payer,
            to: module.payTo,
            value: verifyResult.value || module.priceAmount,
            network: module.network,
          },
        };

        // Issue session pass for per_session modules
        if (
          supportsSessionPass(module.pricingMode, module.sessionPolicy) &&
          module.sessionPolicy &&
          verifyResult.payer &&
          settleResult.txHash
        ) {
          try {
            const sessionPassInfo = await issueSessionPass({
              walletAddress: verifyResult.payer,
              moduleId: id,
              paymentTxHash: settleResult.txHash,
              sessionPolicy: module.sessionPolicy,
            });
            // Consume first credit for this message
            await consumeSessionCredit({
              moduleId: id,
              walletAddress: verifyResult.payer,
              paymentTxHash: settleResult.txHash,
            });
            response.sessionPass = {
              ...sessionPassInfo,
              creditsRemaining: sessionPassInfo.creditsRemaining - 1,
            };
          } catch (err) {
            fastify.log.warn(err, 'Failed to issue session pass (non-fatal)');
          }
        }

        return reply.send(response);
      } catch (err) {
        fastify.log.error(err, 'Failed to execute RAG after payment');
        // Note: Payment already settled - should ideally refund but that's complex
        return reply.status(500).send({
          error: 'Failed to generate response',
          payment: {
            txHash: settleResult.txHash,
            status: 'settled',
            note: 'Payment was processed. Please contact support if issue persists.',
          },
        });
      }
    }
  );
}

// Helper functions

async function getOrCreateChat(
  pool: ReturnType<typeof getPool>,
  existingChatId: string | null | undefined,
  moduleId: string,
  walletAddress: string | undefined
) {
  if (existingChatId) {
    const result = await pool.query('SELECT id FROM chats WHERE id = $1 AND module_id = $2', [
      existingChatId,
      moduleId,
    ]);
    if (result.rows.length > 0) {
      return { id: existingChatId, isNew: false };
    }
  }

  // Create new chat
  const result = await pool.query(
    'INSERT INTO chats (module_id, wallet_address) VALUES ($1, $2) RETURNING id',
    [moduleId, walletAddress || null]
  );
  return { id: result.rows[0].id, isNew: true };
}

async function saveMessage(
  pool: ReturnType<typeof getPool>,
  chatId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number }
) {
  await pool.query(
    'INSERT INTO chat_messages (chat_id, role, content, token_usage) VALUES ($1, $2, $3, $4)',
    [chatId, role, content, tokenUsage ? JSON.stringify(tokenUsage) : null]
  );
}

interface PaymentRecord {
  moduleId: string;
  payerWallet: string;
  payTo: string;
  value: string;
  txHash?: string;
  network: string;
  event: 'settled' | 'failed';
  error?: string;
}

async function recordPayment(pool: ReturnType<typeof getPool>, payment: PaymentRecord) {
  await pool.query(
    `INSERT INTO payments (module_id, payer_wallet, pay_to, value, tx_hash, network, event, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      payment.moduleId,
      payment.payerWallet,
      payment.payTo,
      payment.value,
      payment.txHash || null,
      payment.network,
      payment.event,
      payment.error || null,
    ]
  );
}
