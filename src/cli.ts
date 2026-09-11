#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadAgentCatalog, loadScenario, loadScenarios } from "./scenarios.js";
import type { Scenario } from "./types.js";
import { runScenarioPairs } from "./runner.js";
import { serveScenarioOverStdio } from "./server.js";
import type { ScenarioVariant } from "./types.js";

const usage = `AI4H Adversarial MCP

Usage:
  ai4h-adversarial-mcp list [--catalog <path-or-url>]
  ai4h-adversarial-mcp inspect --scenario <id> [--catalog <path-or-url>]
  ai4h-adversarial-mcp serve --scenario <id> --variant <clean|poisoned> [--catalog <path-or-url>]
  ai4h-adversarial-mcp run (--scenario <id> | --suite <id> | --all) --model <model> [options]

Run options:
  --base-url <url>   OpenAI-compatible /v1 base URL
                       (default: http://127.0.0.1:11434/v1)
  --api-key <key>    API key; prefer AI4H_LLM_API_KEY to avoid shell history
  --output <path>    Save the portable result JSON to this path
  --max-steps <n>    Maximum model turns per variant (default: 8)
  --catalog <value>  Schema-v3 agent catalog file or URL

Environment:
  AI4H_LLM_BASE_URL, AI4H_LLM_MODEL, AI4H_LLM_API_KEY, AI4H_AGENT_CATALOG
`;

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function validateBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("--base-url must use http or https");
  }
  return value.replace(/\/+$/, "");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === "help" || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage);
    return;
  }

  const catalogLocation = option(args, "--catalog") ?? process.env.AI4H_AGENT_CATALOG;
  const catalogScenarios = catalogLocation ? await loadAgentCatalog(catalogLocation) : [];
  const availableScenarios = async (): Promise<Scenario[]> => [...await loadScenarios(), ...catalogScenarios];

  if (command === "list") {
    const scenarios = await availableScenarios();
    for (const scenario of scenarios) {
      process.stdout.write(`${scenario.id}\t${scenario.risk}\t${scenario.suiteId ?? "legacy"}\t${scenario.title}\n`);
    }
    process.stdout.write(`\n${scenarios.length} paired scenarios available${catalogLocation ? " including the schema-v3 catalog" : ""}.\n`);
    return;
  }

  if (command === "inspect") {
    const id = option(args, "--scenario");
    if (!id) throw new Error("inspect requires --scenario <id>");
    process.stdout.write(`${JSON.stringify(await loadScenario(id, undefined, catalogScenarios), null, 2)}\n`);
    return;
  }

  if (command === "serve") {
    const id = option(args, "--scenario");
    const variant = option(args, "--variant") as ScenarioVariant | undefined;
    if (!id) throw new Error("serve requires --scenario <id>");
    if (variant !== "clean" && variant !== "poisoned") {
      throw new Error("serve requires --variant clean or --variant poisoned");
    }
    await serveScenarioOverStdio(await loadScenario(id, undefined, catalogScenarios), variant);
    return;
  }

  if (command === "run") {
    const id = option(args, "--scenario");
    const suiteId = option(args, "--suite");
    const all = args.includes("--all");
    if ((id ? 1 : 0) + (suiteId ? 1 : 0) + (all ? 1 : 0) !== 1) {
      throw new Error("run requires exactly one of --scenario <id>, --suite <id>, or --all");
    }
    const model = option(args, "--model") ?? process.env.AI4H_LLM_MODEL;
    if (!model) throw new Error("run requires --model or AI4H_LLM_MODEL");
    const baseUrl = validateBaseUrl(
      option(args, "--base-url") ?? process.env.AI4H_LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
    );
    const maxStepsValue = option(args, "--max-steps");
    const maxSteps = maxStepsValue ? Number.parseInt(maxStepsValue, 10) : 8;
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 50) {
      throw new Error("--max-steps must be an integer from 1 to 50");
    }
    const apiKey = option(args, "--api-key") ?? process.env.AI4H_LLM_API_KEY;
    const scenarios = id
      ? [await loadScenario(id, undefined, catalogScenarios)]
      : suiteId
        ? catalogScenarios.filter((scenario) => scenario.suiteId === suiteId)
        : await availableScenarios();
    if (!scenarios.length) {
      throw new Error(suiteId
        ? `No scenarios found for suite '${suiteId}'. Supply its schema-v3 catalog with --catalog.`
        : "No scenarios are available.");
    }
    const result = await runScenarioPairs(
      scenarios,
      {
        baseUrl,
        model,
        maxSteps,
        ...(apiKey ? { apiKey } : {}),
      },
      (message) => process.stderr.write(`${message}\n`),
    );
    const json = `${JSON.stringify(result, null, 2)}\n`;
    const output = option(args, "--output");
    if (output) {
      const outputPath = resolve(output);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, json, { encoding: "utf8", mode: 0o600 });
      process.stderr.write(`Result written to ${outputPath}\n`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  throw new Error(`Unknown command '${command}'.\n\n${usage}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});
