import { getPool } from '../lib/db.js';
import { executeRAG } from './rag.js';
import { getConfig } from '../config.js';

export interface EvalCase {
  id: string;
  moduleId: string;
  prompt: string;
  rubric: string | null;
  expectedKeywords: string[];
  createdAt: Date;
}

export interface EvalCaseResult {
  caseId: string;
  prompt: string;
  response: string;
  score: number;
  passed: boolean;
  matchedKeywords: string[];
  missingKeywords: string[];
  rubricEval?: string;
}

export interface EvalRunResult {
  id: string;
  moduleId: string;
  score: number;
  totalCases: number;
  passedCases: number;
  details: EvalCaseResult[];
  createdAt: Date;
}

/**
 * Get eval cases for a module
 */
export async function getEvalCases(moduleId: string): Promise<EvalCase[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, module_id, prompt, rubric, expected_keywords, created_at
     FROM eval_cases WHERE module_id = $1 ORDER BY created_at ASC`,
    [moduleId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    moduleId: row.module_id,
    prompt: row.prompt,
    rubric: row.rubric,
    expectedKeywords: row.expected_keywords || [],
    createdAt: row.created_at,
  }));
}

/**
 * Add eval cases to a module
 */
export async function addEvalCases(
  moduleId: string,
  cases: Array<{ prompt: string; rubric?: string; expectedKeywords?: string[] }>
): Promise<EvalCase[]> {
  const pool = getPool();
  const insertedCases: EvalCase[] = [];

  for (const evalCase of cases) {
    const result = await pool.query(
      `INSERT INTO eval_cases (module_id, prompt, rubric, expected_keywords)
       VALUES ($1, $2, $3, $4)
       RETURNING id, module_id, prompt, rubric, expected_keywords, created_at`,
      [moduleId, evalCase.prompt, evalCase.rubric || null, evalCase.expectedKeywords || []]
    );

    const row = result.rows[0];
    insertedCases.push({
      id: row.id,
      moduleId: row.module_id,
      prompt: row.prompt,
      rubric: row.rubric,
      expectedKeywords: row.expected_keywords || [],
      createdAt: row.created_at,
    });
  }

  return insertedCases;
}

/**
 * Delete all eval cases for a module
 */
export async function deleteEvalCases(moduleId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query('DELETE FROM eval_cases WHERE module_id = $1', [moduleId]);
  return result.rowCount || 0;
}

/**
 * Evaluate a single case using keyword matching
 */
function evaluateCaseByKeywords(response: string, expectedKeywords: string[]): {
  score: number;
  passed: boolean;
  matchedKeywords: string[];
  missingKeywords: string[];
} {
  if (expectedKeywords.length === 0) {
    return { score: 1, passed: true, matchedKeywords: [], missingKeywords: [] };
  }

  const responseLower = response.toLowerCase();
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  for (const keyword of expectedKeywords) {
    if (responseLower.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword);
    } else {
      missingKeywords.push(keyword);
    }
  }

  const matchRatio = matchedKeywords.length / expectedKeywords.length;
  const passed = matchRatio >= 0.7; // 70% threshold
  const score = matchRatio;

  return { score, passed, matchedKeywords, missingKeywords };
}

/**
 * Run eval for a module
 */
export async function runEval(moduleId: string): Promise<EvalRunResult> {
  const pool = getPool();
  const config = getConfig();

  // Get eval cases
  const cases = await getEvalCases(moduleId);

  if (cases.length === 0) {
    throw new Error('No eval cases defined for this module');
  }

  const results: EvalCaseResult[] = [];
  let totalScore = 0;
  let passedCases = 0;

  // Run each case
  for (const evalCase of cases) {
    try {
      // Execute RAG for this prompt
      const ragResult = await executeRAG({
        moduleId,
        userMessage: evalCase.prompt,
      });

      // Evaluate the response
      const evaluation = evaluateCaseByKeywords(ragResult.reply, evalCase.expectedKeywords);

      const caseResult: EvalCaseResult = {
        caseId: evalCase.id,
        prompt: evalCase.prompt,
        response: ragResult.reply,
        score: evaluation.score,
        passed: evaluation.passed,
        matchedKeywords: evaluation.matchedKeywords,
        missingKeywords: evaluation.missingKeywords,
      };

      if (evaluation.passed) {
        passedCases++;
      }
      totalScore += evaluation.score;
      results.push(caseResult);
    } catch (err) {
      // If RAG fails, score this case as 0
      results.push({
        caseId: evalCase.id,
        prompt: evalCase.prompt,
        response: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        score: 0,
        passed: false,
        matchedKeywords: [],
        missingKeywords: evalCase.expectedKeywords,
      });
    }
  }

  // Calculate final score (0-10 scale)
  const averageScore = totalScore / cases.length;
  const finalScore = Math.round(averageScore * 10);

  // Store eval run
  const runResult = await pool.query(
    `INSERT INTO eval_runs (module_id, score, details)
     VALUES ($1, $2, $3)
     RETURNING id, module_id, score, details, created_at`,
    [moduleId, finalScore, JSON.stringify(results)]
  );

  // Update module eval_score
  await pool.query(
    `UPDATE modules SET eval_score = $1, last_eval_at = NOW(), updated_at = NOW()
     WHERE id = $2`,
    [finalScore, moduleId]
  );

  const run = runResult.rows[0];

  return {
    id: run.id,
    moduleId: run.module_id,
    score: run.score,
    totalCases: cases.length,
    passedCases,
    details: results,
    createdAt: run.created_at,
  };
}

/**
 * Get latest eval run for a module
 */
export async function getLatestEvalRun(moduleId: string): Promise<EvalRunResult | null> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, module_id, score, details, created_at
     FROM eval_runs WHERE module_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [moduleId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const run = result.rows[0];
  const details = run.details as EvalCaseResult[];

  return {
    id: run.id,
    moduleId: run.module_id,
    score: run.score,
    totalCases: details.length,
    passedCases: details.filter((d) => d.passed).length,
    details,
    createdAt: run.created_at,
  };
}

/**
 * Get all eval runs for a module
 */
export async function getEvalRuns(moduleId: string): Promise<EvalRunResult[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, module_id, score, details, created_at
     FROM eval_runs WHERE module_id = $1
     ORDER BY created_at DESC LIMIT 10`,
    [moduleId]
  );

  return result.rows.map((run) => {
    const details = run.details as EvalCaseResult[];
    return {
      id: run.id,
      moduleId: run.module_id,
      score: run.score,
      totalCases: details.length,
      passedCases: details.filter((d) => d.passed).length,
      details,
      createdAt: run.created_at,
    };
  });
}
