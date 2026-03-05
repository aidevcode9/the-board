// ── Langfuse LLM-as-Judge Prompt Builders ────────────────────────────────────
// Judge prompts for evaluating debate quality. Each prompt evaluates one metric
// and returns a structured JSON response with score (0-1) and reasoning.
//
// See EVALS.md for metric definitions and thresholds.
// Phase 2: Single judge per metric. Phase 3: Dual-judge with divergence check.

/** Eval metric definition with name, threshold, and description. */
export interface EvalMetric {
  name: 'relevancy' | 'faithfulness' | 'completeness' | 'debate_quality';
  threshold: number;
  description: string;
}

/** All eval metrics with their thresholds from EVALS.md. */
export const EVAL_METRICS: EvalMetric[] = [
  {
    name: 'relevancy',
    threshold: 0.8,
    description: 'Does the synthesis actually answer the query?',
  },
  {
    name: 'faithfulness',
    threshold: 0.85,
    description: "Are claims in the synthesis supported by the models' reasoning?",
  },
  {
    name: 'completeness',
    threshold: 0.75,
    description: 'Did the synthesis incorporate the strongest points from all three models?',
  },
  {
    name: 'debate_quality',
    threshold: 0.7,
    description: 'Did genuine disagreement and constructive critique occur?',
  },
];

/** Parsed judge response. */
export interface JudgeResult {
  score: number;
  reasoning: string;
}

const JSON_INSTRUCTION = `
Respond with ONLY a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reasoning": "<brief explanation>"}

Do not include any text outside the JSON object.`.trim();

/**
 * Build a relevancy judge prompt.
 * Evaluates whether the synthesis answers the original query.
 */
export function buildRelevancyJudgePrompt(query: string, synthesis: string): string {
  return `You are an expert evaluator assessing answer relevancy.

Given the original query and the synthesized answer, score how well the synthesis addresses the query.

A score of 1.0 means the synthesis perfectly addresses every aspect of the query.
A score of 0.0 means the synthesis is completely irrelevant to the query.

## Original Query
${query}

## Synthesized Answer
${synthesis}

## Scoring Criteria
- Does the synthesis directly address the question asked?
- Are all parts of a multi-part question covered?
- Is the response focused on the topic (no irrelevant tangents)?
- Would this answer satisfy someone asking this question?

${JSON_INSTRUCTION}`;
}

/**
 * Build a faithfulness judge prompt.
 * Evaluates whether synthesis claims are supported by model reasoning.
 */
export function buildFaithfulnessJudgePrompt(
  synthesis: string,
  responses: Record<string, { content: string }>,
): string {
  const responseSection = Object.entries(responses)
    .map(([role, r]) => `### ${role}\n${r.content}`)
    .join('\n\n');

  return `You are an expert evaluator assessing faithfulness.

Evaluate whether claims in the synthesis are supported by the individual model responses. The synthesis should not introduce claims that none of the models made.

A score of 1.0 means every claim in the synthesis is traceable to a model's response.
A score of 0.0 means the synthesis fabricates claims not found in any response.

## Synthesized Answer
${synthesis}

## Individual Model Responses
${responseSection}

## Scoring Criteria
- Can each claim in the synthesis be attributed to at least one model?
- Does the synthesis accurately represent the models' positions?
- Are there any hallucinated or fabricated claims?

${JSON_INSTRUCTION}`;
}

/**
 * Build a completeness judge prompt.
 * Evaluates whether synthesis incorporates key points from all models.
 */
export function buildCompletenessJudgePrompt(
  synthesis: string,
  responses: Record<string, { content: string }>,
): string {
  const responseSection = Object.entries(responses)
    .map(([role, r]) => `### ${role}\n${r.content}`)
    .join('\n\n');

  return `You are an expert evaluator assessing completeness.

Evaluate whether the synthesis incorporates the strongest points from all three model responses.

A score of 1.0 means all significant points from all models are represented.
A score of 0.0 means the synthesis only includes one model's perspective.

## Synthesized Answer
${synthesis}

## Individual Model Responses
${responseSection}

## Scoring Criteria
- Does the synthesis include key points from each model?
- Are the strongest arguments from each model preserved?
- Does the synthesis represent all three perspectives?
- Are dissenting points acknowledged even if the synthesis disagrees?

${JSON_INSTRUCTION}`;
}

/**
 * Build a debate quality judge prompt.
 * Evaluates whether genuine disagreement occurred.
 */
export function buildDebateQualityJudgePrompt(
  responses: Record<string, { content: string }>,
  reviews: Record<string, unknown>,
): string {
  const responseSection = Object.entries(responses)
    .map(([role, r]) => `### ${role}\n${r.content}`)
    .join('\n\n');

  const reviewSection = JSON.stringify(reviews, null, 2);

  return `You are an expert evaluator assessing debate quality.

Evaluate whether the debate produced genuine intellectual disagreement and constructive critique, rather than superficial agreement (sycophancy).

A score of 1.0 means vigorous, substantive disagreement with specific critiques.
A score of 0.0 means all models immediately agreed without any pushback.

## Model Responses
${responseSection}

## Cross-Review Data
${reviewSection}

## Scoring Criteria
- Did at least one model challenge another's specific claim?
- Were concrete flaws identified (not just "could be improved")?
- Did models maintain their positions when challenged?
- Did the review phase produce actionable critique?
- Was the disagreement substantive (about content) not superficial?

${JSON_INSTRUCTION}`;
}

/**
 * Parse a judge's JSON response, extracting score and reasoning.
 * Returns null if the response cannot be parsed.
 */
export function parseJudgeResponse(content: string): JudgeResult | null {
  // Try full JSON parse first (most reliable)
  try {
    const parsed = JSON.parse(content.trim());
    if (typeof parsed.score === 'number') {
      return {
        score: Math.min(1, Math.max(0, parsed.score)),
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    }
  } catch {
    // Fall through to regex extraction
  }

  // Fallback: non-greedy regex extraction for wrapped responses
  try {
    const jsonMatch = content.match(/\{[\s\S]*?"score"\s*:\s*[\d.]+[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.score !== 'number') return null;

    return {
      score: Math.min(1, Math.max(0, parsed.score)),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}
