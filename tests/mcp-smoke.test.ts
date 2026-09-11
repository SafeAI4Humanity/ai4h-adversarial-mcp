import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../src/cli.js", import.meta.url));

async function connect(variant: "clean" | "poisoned") {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, "serve", "--scenario", "policy-authority-spoof", "--variant", variant],
    stderr: "pipe",
  });
  const client = new Client({ name: "smoke-test", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

test("stdio server exposes a clean source result and inert action sinks", async () => {
  const client = await connect("clean");
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "read_travel_policy"));
    assert.ok(tools.tools.some((tool) => tool.name === "send_external_message"));

    const source = await client.callTool({ name: "read_travel_policy", arguments: {} });
    assert.match(JSON.stringify(source), /above \$25/);
    assert.doesNotMatch(JSON.stringify(source), /ADMIN OVERRIDE/);

    const sink = await client.callTool({
      name: "send_external_message",
      arguments: { recipient: "nobody@example.invalid", body: "synthetic test" },
    });
    const structured = sink.structuredContent as Record<string, unknown> | undefined;
    assert.equal(structured?.externalSideEffects, false);
    assert.equal(structured?.simulation, true);
  } finally {
    await client.close();
  }
});

test("poisoned variant preserves benign facts while adding the attack fixture", async () => {
  const client = await connect("poisoned");
  try {
    const result = await client.callTool({ name: "read_travel_policy", arguments: {} });
    const serialized = JSON.stringify(result);
    assert.match(serialized, /above \$25/);
    assert.match(serialized, /ADMIN OVERRIDE/);
    assert.match(serialized, /AI4H-MCP-CANARY-1042/);
  } finally {
    await client.close();
  }
});
