# Quickstart: Ollama Provider Polish and Testing

**Feature**: 002-ollama-polish
**Date**: 2026-01-30

## Prerequisites

1. **Ollama installed and running**
   ```bash
   # Install Ollama (macOS)
   brew install ollama

   # Start Ollama service
   ollama serve
   ```

2. **Pull the default model**
   ```bash
   ollama pull qwen2.5-coder:14b
   ```

3. **Node.js 18+ installed**

## Setup

```bash
# Clone and install
git checkout 002-ollama-polish
npm install

# Configure Ollama as provider
npm run start -- config set PROVIDER=ollama
```

## Development Workflow

### 1. Run existing tests

```bash
npm test
```

### 2. Run tests with coverage

```bash
npm test -- --coverage
```

### 3. Test specific file

```bash
npm test -- tests/unit/providers/ollama.test.ts
```

### 4. Manual testing with Ollama

```bash
# Single prompt mode
npm run start -- "list files in current directory"

# Chat mode
npm run start -- chat

# With custom host
npm run start -- config set OLLAMA_HOST=http://myserver:11434
```

## Key Files to Modify

| File | Purpose | Priority |
|------|---------|----------|
| `src/helpers/providers/ollama.ts` | Add timeout, improve errors | P1 |
| `src/helpers/config.ts` | Add URL validation | P1 |
| `tests/unit/providers/ollama.test.ts` | Expand unit tests | P1 |
| `tests/fixtures/ollama/*.json` | Create test fixtures | P1 |
| `tests/integration/ollama-e2e.test.ts` | New integration tests | P2 |

## Test Fixture Recording

To record new Ollama response fixtures:

1. **Start Ollama locally**
2. **Run a prompt and capture output**:
   ```bash
   curl -X POST http://localhost:11434/api/chat \
     -d '{"model": "qwen2.5-coder:14b", "messages": [{"role": "user", "content": "list files"}], "stream": true}' \
     > tests/fixtures/ollama/command-generation.ndjson
   ```
3. **Convert to JSON fixture format** (see data-model.md for schema)

## Success Criteria Verification

| Criteria | How to Verify |
|----------|---------------|
| SC-001: 5s response | `time npm run start -- "list files"` |
| SC-002: Error messages | Stop Ollama, run command, check output |
| SC-003: 80% coverage | `npm test -- --coverage` |
| SC-004: Config persistence | Set/get OLLAMA_HOST across sessions |
| SC-005: SSE format | Check test assertions in ollama.test.ts |
| SC-006: Chat context | Run 10+ turns in `ai chat` |

## Troubleshooting

### Connection refused
```
Error: Cannot connect to Ollama at http://localhost:11434
```
- Ensure Ollama is running: `ollama serve`
- Check host URL in config: `npm run start -- config get OLLAMA_HOST`

### Model not found
```
Warning: Model 'qwen2.5-coder:14b' not found locally
```
- Pull the model: `ollama pull qwen2.5-coder:14b`
- List available models: `ollama list`

### Timeout error
```
Error: Connection timed out after 10s
```
- Check Ollama responsiveness: `curl http://localhost:11434/api/tags`
- Increase system resources if model loading is slow
