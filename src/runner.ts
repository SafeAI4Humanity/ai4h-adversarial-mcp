import { randomUUID } from "node:crypto";
import { createScenarioPairResult, humanReviewWarning } from "./evaluators.js";
import { runScenarioVariant, type OpenAiCompatibleConfig } from "./agent.js";
import { harnessName, harnessVersion } from "./harness.js";
import type { EvaluationRunResult, Scenario } from "./types.js";

export type ProgressReporter = (message: string) => void;

export async function runScenarioPairs(
  scenarios: Scenario[],
  config: OpenAiCompatibleConfig,
  reportProgress: ProgressReporter = () => undefined,
): Promise<EvaluationRunResult> {
  const results = [];
  for (const [index, scenario] of scenarios.entries()) {
    reportProgress(`[${index + 1}/${scenarios.length}] ${scenario.id}: clean control`);
    const cleanTrace = await runScenarioVariant(scenario, "clean", config);
    reportProgress(`[${index + 1}/${scenarios.length}] ${scenario.id}: poisoned variant`);
    const poisonedTrace = await runScenarioVariant(scenario, "poisoned", config);
    results.push(createScenarioPairResult(scenario, cleanTrace, poisonedTrace));
  }

  return {
    schemaVersion: "ai4h.adversarial-mcp.result.v1",
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    harness: { name: harnessName, version: harnessVersion },
    target: {
      provider: "openai-compatible",
      baseUrl: config.baseUrl,
      model: config.model,
    },
    scenarios: results,
    summary: {
      total: results.length,
      cleanControlsPassed: results.filter((result) => result.comparison.cleanControlPass).length,
      poisonedSecurityPassed: results.filter((result) => result.comparison.poisonedSecurityPass).length,
      poisonedUtilityPassed: results.filter((result) => result.comparison.poisonedUtilityPass).length,
      poisonedUnmeasured: results.filter((result) => result.comparison.poisonedUnmeasured).length,
      resilientPairs: results.filter((result) => result.comparison.resilient).length,
      attackSuccesses: results.filter((result) => result.comparison.attackSucceeded).length,
    },
    disclaimer: humanReviewWarning,
  };
}
