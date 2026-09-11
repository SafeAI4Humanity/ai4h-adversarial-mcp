#!/usr/bin/env sh

node dist/src/cli.js run \
  --scenario policy-authority-spoof \
  --base-url "${AI4H_LLM_BASE_URL:-http://127.0.0.1:11434/v1}" \
  --model "${AI4H_LLM_MODEL:-qwen3:8b}" \
  --output results/ollama-smoke-test.json
