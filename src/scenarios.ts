import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { harnessName, harnessVersion, supportsMinimumVersion } from "./harness.js";
import type { Scenario } from "./types.js";

const textContentSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
});

const toolResponseSchema = z.object({
  content: z.array(textContentSchema).min(1),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  isError: z.boolean().optional(),
});

const assistantCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  anyOf: z.array(z.string().min(1)).min(1),
});

const requiredAssistantSchema = z.union([
  z.array(assistantCriterionSchema),
  z.object({
    clean: z.array(assistantCriterionSchema),
    poisoned: z.array(assistantCriterionSchema),
  }),
]);

const scenarioSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(3)]),
  suiteId: z.string().optional(),
  suiteVersion: z.string().optional(),
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]+$/),
  version: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum([
    "authority-spoofing",
    "data-exfiltration",
    "privilege-escalation",
    "misinformation",
    "unauthorized-action",
    "error-channel-injection",
    "structured-content-injection",
    "content-conflict",
    "approval-bypass",
    "cross-tool-injection",
    "agent-scope-control",
    "agent-reality-assessment",
    "agent-stop-behavior",
    "agent-data-protection",
  ]),
  // "low" is accepted so a low-risk catalog suite maps through losslessly; risk is descriptive output only.
  risk: z.enum(["low", "medium", "high", "critical"]),
  task: z.string().min(1),
  protectedCanaries: z.array(z.string().min(1)),
  authorizedScope: z.object({
    targets: z.array(z.string().min(1)).min(1),
    actions: z.array(z.string().min(1)).min(1),
    boundary: z.string().min(1),
  }).optional(),
  stopConditions: z.array(z.string().min(1)).optional(),
  prohibitedActions: z.array(z.string().min(1)).optional(),
  sourceTool: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    title: z.string().min(1),
    description: z.string().min(1),
    inputMode: z.enum(["none", "query", "recordId"]),
    clean: toolResponseSchema,
    poisoned: toolResponseSchema,
  }),
  expectations: z.object({
    requiredAssistant: requiredAssistantSchema,
    forbiddenAssistant: z.array(z.string().min(1)),
    forbiddenToolCalls: z.array(z.string().min(1)),
    forbiddenToolArgumentStrings: z.array(z.string().min(1)),
    humanReviewRubric: z.string().min(1),
  }),
});

export const scenariosDirectory = fileURLToPath(new URL("../../scenarios/", import.meta.url));

function assertUnique(scenarios: Scenario[]): Scenario[] {
  const ids = new Set<string>();
  const toolNames = new Set<string>();
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    if (toolNames.has(scenario.sourceTool.name)) throw new Error(`Duplicate source tool name: ${scenario.sourceTool.name}`);
    ids.add(scenario.id);
    toolNames.add(scenario.sourceTool.name);
  }
  return scenarios;
}

export async function loadScenarios(directory = scenariosDirectory): Promise<Scenario[]> {
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const scenarios = await Promise.all(
    files.map(async (file) => {
      const value: unknown = JSON.parse(await readFile(join(directory, file), "utf8"));
      return scenarioSchema.parse(value) as Scenario;
    }),
  );

  return assertUnique(scenarios);
}

function agentCategory(value: string): Scenario["category"] {
  const normalized = value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const allowed: Scenario["category"][] = [
    "agent-scope-control", "agent-reality-assessment", "agent-stop-behavior", "agent-data-protection",
  ];
  if (!allowed.includes(normalized as Scenario["category"])) {
    throw new Error(`Unsupported schema-v3 agent category: ${value}`);
  }
  return normalized as Scenario["category"];
}

async function readCatalog(location: string): Promise<unknown> {
  if (/^https?:\/\//i.test(location)) {
    const response = await fetch(location);
    if (!response.ok) throw new Error(`Could not load agent catalog (${response.status} ${response.statusText}).`);
    return response.json();
  }
  return JSON.parse(await readFile(resolve(location), "utf8")) as unknown;
}

export async function loadAgentCatalog(location: string): Promise<Scenario[]> {
  const catalog = z.object({
    schemaVersion: z.literal(3),
    catalogVersion: z.string().min(1),
    suites: z.array(z.object({
      schemaVersion: z.literal(3),
      id: z.string().min(1),
      version: z.string().min(1),
      title: z.string().min(1),
      category: z.string().min(1),
      risk: z.enum(["low", "moderate", "high"]),
      runner: z.object({
        id: z.literal(harnessName),
        minimumVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
      }),
      cases: z.array(z.unknown()).min(1),
    })).min(1),
  }).passthrough().parse(await readCatalog(location));

  const scenarios: Scenario[] = [];
  for (const suite of catalog.suites) {
    if (!supportsMinimumVersion(suite.runner.minimumVersion)) {
      throw new Error(
        `Suite '${suite.id}' requires ${harnessName} ${suite.runner.minimumVersion} or newer; installed version is ${harnessVersion}.`,
      );
    }
    for (const rawCase of suite.cases) {
      const testCase = z.object({
        id: z.string().min(1), title: z.string().min(1), summary: z.string().optional(),
        // A bare z.unknown() key is still required in zod 4, so the three optional fields say so.
        task: z.string().min(1), authorizedScope: z.unknown().optional(), stopConditions: z.unknown().optional(),
        prohibitedActions: z.unknown().optional(), protectedCanaries: z.unknown(), sourceTool: z.unknown(),
        expectations: z.unknown(),
      }).passthrough().parse(rawCase);
      const id = `${suite.id}.${testCase.id}`;
      scenarios.push(scenarioSchema.parse({
        schemaVersion: 3,
        suiteId: suite.id,
        suiteVersion: suite.version,
        id,
        version: suite.version,
        title: `${suite.title}: ${testCase.title}`,
        summary: testCase.summary ?? testCase.title,
        category: agentCategory(suite.category),
        risk: suite.risk === "moderate" ? "medium" : suite.risk,
        task: testCase.task,
        // These three stay absent when the case omits them; an explicit undefined key fails the schema.
        ...(testCase.authorizedScope ? { authorizedScope: testCase.authorizedScope } : {}),
        ...(testCase.stopConditions ? { stopConditions: testCase.stopConditions } : {}),
        ...(testCase.prohibitedActions ? { prohibitedActions: testCase.prohibitedActions } : {}),
        protectedCanaries: testCase.protectedCanaries,
        sourceTool: testCase.sourceTool,
        expectations: testCase.expectations,
      }) as Scenario);
    }
  }
  return assertUnique(scenarios);
}

export async function loadScenario(id: string, directory = scenariosDirectory, additional: Scenario[] = []): Promise<Scenario> {
  const scenario = [...await loadScenarios(directory), ...additional].find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Unknown scenario '${id}'. Run 'list' to see available scenarios.`);
  }
  return scenario;
}
