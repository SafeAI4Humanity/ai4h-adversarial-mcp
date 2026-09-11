export type ScenarioVariant = "clean" | "poisoned";

export type ScenarioCategory =
  | "authority-spoofing"
  | "data-exfiltration"
  | "privilege-escalation"
  | "misinformation"
  | "unauthorized-action"
  | "error-channel-injection"
  | "structured-content-injection"
  | "content-conflict"
  | "approval-bypass"
  | "cross-tool-injection"
  | "agent-scope-control"
  | "agent-reality-assessment"
  | "agent-stop-behavior"
  | "agent-data-protection";

export interface TextContent {
  type: "text";
  text: string;
}

export interface ScenarioToolResponse {
  [key: string]: unknown;
  content: TextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export type SourceInputMode = "none" | "query" | "recordId";

export interface ScenarioSourceTool {
  name: string;
  title: string;
  description: string;
  inputMode: SourceInputMode;
  clean: ScenarioToolResponse;
  poisoned: ScenarioToolResponse;
}

export interface RequiredAssistantCriterion {
  id: string;
  label: string;
  anyOf: string[];
}

export interface ScenarioExpectations {
  requiredAssistant:
    | RequiredAssistantCriterion[]
    | { clean: RequiredAssistantCriterion[]; poisoned: RequiredAssistantCriterion[] };
  forbiddenAssistant: string[];
  forbiddenToolCalls: string[];
  forbiddenToolArgumentStrings: string[];
  humanReviewRubric: string;
}

export interface Scenario {
  schemaVersion: 1 | 3;
  suiteId?: string;
  suiteVersion?: string;
  id: string;
  version: string;
  title: string;
  summary: string;
  category: ScenarioCategory;
  risk: "low" | "medium" | "high" | "critical";
  task: string;
  protectedCanaries: string[];
  authorizedScope?: {
    targets: string[];
    actions: string[];
    boundary: string;
  };
  stopConditions?: string[];
  prohibitedActions?: string[];
  sourceTool: ScenarioSourceTool;
  expectations: ScenarioExpectations;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** Present only when the model's argument string could not be parsed as a JSON object. */
  rawArguments?: string;
}

export interface ToolResultRecord {
  toolCallId: string;
  name: string;
  response: ScenarioToolResponse;
}

export interface AgentTrace {
  scenarioId: string;
  variant: ScenarioVariant;
  task: string;
  startedAt: string;
  completedAt: string;
  finalResponse: string;
  toolCalls: ToolCallRecord[];
  toolResults: ToolResultRecord[];
  steps: number;
  status: "completed" | "max_steps" | "error";
  error?: string;
}

export interface CriterionResult {
  id: string;
  dimension: "utility" | "security";
  label: string;
  pass: boolean;
  evidence: string;
}

export interface TraceEvaluation {
  utilityPass: boolean;
  securityPass: boolean;
  overallPass: boolean;
  criteria: CriterionResult[];
  humanReview: {
    required: true;
    warning: string;
    rubric: string;
  };
}

export interface VariantResult {
  trace: AgentTrace;
  evaluation: TraceEvaluation;
}

export interface ScenarioPairResult {
  scenario: Pick<Scenario, "id" | "version" | "title" | "summary" | "category" | "risk" | "suiteId" | "suiteVersion">;
  clean: VariantResult;
  poisoned: VariantResult;
  comparison: {
    cleanControlPass: boolean;
    poisonedSecurityPass: boolean;
    poisonedUtilityPass: boolean;
    poisonedUnmeasured: boolean;
    resilient: boolean;
    attackSucceeded: boolean;
  };
}

export interface EvaluationRunResult {
  schemaVersion: "ai4h.adversarial-mcp.result.v1";
  runId: string;
  createdAt: string;
  harness: {
    name: "@safeai4humanity/adversarial-mcp";
    version: string;
  };
  target: {
    provider: "openai-compatible";
    baseUrl: string;
    model: string;
  };
  scenarios: ScenarioPairResult[];
  summary: {
    total: number;
    cleanControlsPassed: number;
    poisonedSecurityPassed: number;
    poisonedUtilityPassed: number;
    poisonedUnmeasured: number;
    resilientPairs: number;
    attackSuccesses: number;
  };
  disclaimer: string;
}
