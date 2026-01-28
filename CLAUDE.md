# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Shell is a CLI tool that converts natural language to shell commands using OpenAI's API. Users type `ai <prompt>` and get a shell command suggestion with an explanation, then can run, edit, revise, copy, or cancel.

## Development Commands

```bash
npm start          # Run in dev mode (uses jiti for TypeScript)
npm run build      # Production build with pkgroll
npm run build -w   # Watch mode for development
npm run lint       # Check formatting (prettier) and linting (eslint)
npm run lint:fix   # Auto-fix formatting and lint issues
npm run typecheck  # TypeScript type checking
./dist/cli.mjs     # Run the built CLI directly
```

## Architecture

**Entry Flow:**
- `src/cli.ts` → CLI argument parsing with `cleye`, routes to commands or prompt flow
- `src/prompt.ts` → Main interactive flow: gets user prompt, calls OpenAI, displays script + explanation, presents run/edit/revise/copy/cancel options

**Commands** (`src/commands/`):
- `config.ts` - Config management (get/set/UI for `~/.ai-shell` INI file)
- `chat.ts` - Interactive conversation mode with history
- `update.ts` - Self-update via npm

**Core Helpers** (`src/helpers/`):
- `completion.ts` - OpenAI API integration with streaming; key functions: `getScriptAndInfo()`, `getExplanation()`, `getRevision()`
- `config.ts` - Reads/writes `~/.ai-shell` config (OPENAI_KEY, OPENAI_API_ENDPOINT, SILENT_MODE, MODEL, LANGUAGE)
- `i18n.ts` - Internationalization with i18next (16 languages in `src/locales/`)
- `os-detect.ts` - Detects user's shell (bash/zsh/fish/etc) for tailored prompts

**Key Dependencies:**
- `cleye` - CLI argument parsing
- `@clack/prompts` - Interactive terminal UI
- `openai` - OpenAI API client (v3.x, uses ChatCompletion streaming)
- `execa` - Shell command execution
- `i18next` - Internationalization

## Config File

User config stored at `~/.ai-shell` in INI format:
```ini
OPENAI_KEY=sk-...
OPENAI_API_ENDPOINT=https://api.openai.com/v1
MODEL=gpt-4o-mini
SILENT_MODE=false
LANGUAGE=en
```

## OpenAI Integration Details

The prompt engineering in `completion.ts`:
- `getFullPrompt()` - Constructs system prompt including shell type (bash/zsh/etc) and OS detection
- Responses are streamed and markdown code blocks are stripped automatically
- Default model is `gpt-4o-mini`
