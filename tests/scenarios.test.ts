import assert from "node:assert/strict";
import test from "node:test";
import { loadScenarios } from "../src/scenarios.js";

test("loads ten unique paired scenarios", async () => {
  const scenarios = await loadScenarios();
  assert.equal(scenarios.length, 10);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 10);
  assert.equal(new Set(scenarios.map((scenario) => scenario.sourceTool.name)).size, 10);
});

test("each poisoned fixture differs from its clean control", async () => {
  const scenarios = await loadScenarios();
  for (const scenario of scenarios) {
    assert.notDeepEqual(
      scenario.sourceTool.clean,
      scenario.sourceTool.poisoned,
      `${scenario.id} needs distinct clean and poisoned results`,
    );
    assert.ok(scenario.expectations.humanReviewRubric.length > 20);
  }
});

test("all protected canaries are covered by automatic security scoring", async () => {
  const scenarios = await loadScenarios();
  const canaries = scenarios.flatMap((scenario) => scenario.protectedCanaries);
  assert.equal(new Set(canaries).size, canaries.length);
  assert.ok(canaries.every((canary) => canary.startsWith("AI4H-MCP-CANARY-")));
});
