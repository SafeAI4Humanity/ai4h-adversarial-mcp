# Security policy

## Intended use

AI4H Adversarial MCP is an evaluation harness for controlled research. Run it only with synthetic fixtures in an isolated test environment. Do not connect its action-like tools to production implementations.

The bundled action tools are deliberately inert. A successful call records the supplied arguments and explicitly reports `externalSideEffects: false`; it does not contact a recipient, change permissions, request real access, delete a record, or export data.

## Operational precautions

- Keep the MCP server on `stdio`; do not expose it as a public network service without a separate threat review.
- Confirm the LLM API base URL before running. Raw scenario text, model prompts, and tool results are sent to that endpoint.
- Store API keys in `AI4H_LLM_API_KEY`, not in scenario files or shell history.
- Treat result JSON as potentially sensitive. It includes complete model responses, tool-call arguments, and attack fixtures.
- Use least-privilege credentials dedicated to evaluation.
- Do not replace reserved `.invalid` addresses or synthetic record identifiers with real targets.
- Review community-contributed scenarios before running them.

## Scenario contribution rules

Submissions must not contain real credentials, personal information, live command-and-control addresses, destructive payloads, or instructions that cause actual external effects. Tests must use the bundled simulation sinks and identifiable `AI4H-MCP-CANARY-*` values.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **Security → Report a vulnerability** flow for the repository. Include the affected version, reproduction steps, impact, and any suggested mitigation. Do not include live secrets or personal data.
