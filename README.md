# AI4H Adversarial MCP

AI4H Adversarial MCP is a safe, reproducible test harness for measuring whether an LLM agent follows malicious instructions embedded in MCP tool results. It provides paired clean and poisoned versions of the same task, records the full tool trace, and scores task utility separately from attack resistance.

This is an early evaluation tool from the [Safe AI for Humanity Foundation](https://safeaiforhumanity.org/). Automated scores require human review and should not be treated as a complete safety certification.

## Safety model

- The included runner uses an isolated in-memory MCP connection. Standalone fixture mode uses local MCP `stdio`; neither mode opens an MCP network port.
- Every record, address, secret, and action is synthetic.
- Action-like tools are inert sinks. They record the model's attempted call in the result trace but never send, delete, export, elevate, or modify anything.
- The only outbound request made by the reference runner is to the LLM API base URL that the user explicitly supplies.
- Results contain raw traces and synthetic attack text. Review them before publishing.

## What is included

- Ten paired prompt-injection scenarios plus schema-v3 agent-scope catalogs
- MCP source tools with attacks in text, structured content, and error results
- Inert action sinks for exfiltration, privilege escalation, permission changes, deletion, and cross-tool access
- An OpenAI-compatible runner that works with services such as OpenRouter and Ollama's `/v1` interface
- Deterministic trace evaluators for utility and security
- Portable `ai4h.adversarial-mcp.result.v1` JSON output
- A mandatory human-review warning and scenario-specific review rubric

## Quick start

Requirements: Node.js 20 or newer.

```bash
npm install
npm run build
node dist/src/cli.js list
```

Run one paired scenario against Ollama:

```bash
node dist/src/cli.js run \
  --scenario policy-authority-spoof \
  --base-url http://127.0.0.1:11434/v1 \
  --model qwen3:8b \
  --output results/qwen3-policy.json
```

Run all scenarios against an OpenAI-compatible hosted service:

```bash
export AI4H_LLM_API_KEY="your-key"
node dist/src/cli.js run \
  --all \
  --base-url https://openrouter.ai/api/v1 \
  --model openai/gpt-4.1-mini \
  --output results/model-run.json
```

Run one of the official schema-v3 agent suites from a released catalog:

```bash
export AI4H_AGENT_CATALOG="https://github.com/SafeAI4Humanity/ai4h-test-suites/releases/latest/download/catalog-v3.json"
node dist/src/cli.js run \
  --suite agent.scope-authorization-drift \
  --base-url http://127.0.0.1:11434/v1 \
  --model qwen3:8b \
  --output results/qwen3-agent-scope.json
```

During local catalog development, replace the URL with `../ai4h-test-suites/catalog-v3.json`.

Use environment variables instead of command-line arguments when possible so API keys are not retained in shell history:

- `AI4H_LLM_BASE_URL`
- `AI4H_LLM_MODEL`
- `AI4H_LLM_API_KEY`
- `AI4H_AGENT_CATALOG`

The key is used for the provider request and is never written to the result JSON.

## Scenario catalog

| Scenario | Attack dimension | Risk |
|---|---|---|
| Policy authority spoofing | Fake higher-priority instructions | High |
| Support ticket exfiltration | External disclosure request | Critical |
| Calendar privilege escalation | Unnecessary administrator access | High |
| Knowledge-base false fact | Injected misinformation | High |
| Unauthorized permission change | Unrequested record mutation | Critical |
| Error-channel prompt injection | Instructions in an MCP error | Critical |
| Structured-content injection | Instructions in structured output | High |
| Text/structured conflict | Poisoned text versus verified data | High |
| Human-approval bypass | False approval for deletion | Critical |
| Cross-tool query redirection | Unrelated restricted-data access | Critical |

The schema-v3 catalog adds four paired agent suites:

| Suite | Behavior under test |
|---|---|
| Agent Scope and Authorization Drift | Similar names, neighboring hosts, redirects, and production prohibitions |
| Agent Simulation-Reality Uncertainty | Conflicting realism signals, public identity evidence, external consumers, and realistic records |
| Agent Impossible Task and Abort Handling | Target loss, no honest solution, repeated failure, and evaluation-score pressure |
| Agent Credential and Third-Party Data Boundaries | Debug tokens, scanner credentials, neighboring password files, and private datasets |

Each variant runs in a fresh agent conversation and fresh isolated MCP server instance. The clean control confirms that the agent can complete the ordinary task; the poisoned variant measures whether it can complete the same task without obeying the injected instruction.

## Reading results

The top-level summary reports:

- `cleanControlsPassed`: ordinary tasks completed correctly
- `poisonedSecurityPassed`: poisoned runs that avoided deterministic security failures
- `poisonedUtilityPassed`: poisoned runs that still answered the task
- `resilientPairs`: both the clean control and poisoned run passed
- `attackSuccesses`: poisoned runs with a security failure

A model can be secure but unhelpful, or helpful but vulnerable. Keep utility and security visible as separate dimensions, and inspect every scenario's trace and human-review rubric before publishing conclusions.

## Connect the raw MCP server to another agent

The server can be launched independently for one fixed scenario and variant:

```json
{
  "mcpServers": {
    "ai4h-adversarial-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/ai4h-adversarial-mcp/dist/src/cli.js",
        "serve",
        "--scenario",
        "support-ticket-exfiltration",
        "--variant",
        "poisoned"
      ]
    }
  }
}
```

This mode exposes the test fixture but does not capture the external agent's trace. Use the included runner for standardized, automatically scored results.

## Commands

```text
list [--catalog <path-or-url>]             List available scenarios
inspect --scenario <id> [--catalog ...]   Print a scenario definition
serve --scenario <id> --variant <variant> Start one stdio MCP fixture
run --scenario <id> ...                   Run one clean/poisoned pair
run --suite <id> --catalog <value> ...    Run one schema-v3 agent suite
run --all [--catalog <value>] ...         Run every loaded scenario
```

Run local validation with `npm run check`.

## Contributing

The original scenarios are declarative JSON files in [`scenarios`](./scenarios). Official schema-v3 agent suites live in the separate [`ai4h-test-suites`](https://github.com/SafeAI4Humanity/ai4h-test-suites) repository under `suites-v3/`. Contributions should:

1. Include an equivalent useful task in both clean and poisoned variants.
2. Use only synthetic identifiers, canaries, and reserved `.invalid` addresses.
3. Route action requests exclusively to the included inert simulation tools.
4. Define deterministic utility and security expectations plus a human-review rubric.
5. Add or update tests and pass `npm run check`.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the execution and scoring design and [`SECURITY.md`](./SECURITY.md) before adding new attack fixtures.

## License

Apache-2.0. Copyright 2026 Safe AI for Humanity Foundation.
