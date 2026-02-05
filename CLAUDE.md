## Project Overview

AI Shell is a CLI tool that converts natural language to shell commands. It supports multiple AI providers (Gemini, OpenAI, Ollama) and offers both single-prompt and interactive chat modes. Built with TypeScript/Node.js using cleye for CLI parsing, @clack/prompts for interactive UI, and i18next for internationalization (16 languages supported).

## Critical Rules

### 1. Code Organization

- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 max per file
- Organize by feature/domain, not by type

### 2. Code Style

- No emojis in code, comments, or documentation
- Immutability always - never mutate objects or arrays
- Proper error handling with try/catch
- Input validation for all user inputs
- Use KnownError for user-facing errors

### 3. Security

- No hardcoded secrets
- Configuration stored in ~/.ai-shell INI file
- Validate all user inputs
- Secure API key storage with obfuscation in UI

## File Structure

```
src/
├── cli.ts              # CLI entry point using cleye
├── prompt.ts           # Main prompt handler
├── commands/           # Command implementations
│   ├── chat.ts        # Interactive chat mode
│   ├── config.ts      # Configuration management
│   └── update.ts      # Self-update command
├── helpers/            # Utility modules
│   ├── config.ts      # INI-based config management
│   ├── completion.ts  # Provider-agnostic completion
│   ├── error.ts       # Error handling utilities
│   ├── i18n.ts        # Internationalization
│   ├── constants.ts   # Application constants
│   └── providers/     # AI provider implementations
│       ├── types.ts   # Provider interface
│       ├── index.ts   # Provider factory
│       ├── gemini.ts  # Google Gemini provider
│       ├── openai.ts  # OpenAI provider
│       └── ollama.ts  # Ollama local provider
└── locales/            # Translation files (16 languages)
```

## Key Patterns

### Provider Pattern

All AI providers implement the CompletionProvider interface:

```typescript
interface CompletionProvider {
  generateCompletion(prompt: string, options: CompletionOptions): Promise<IncomingMessage | ReadableStream>;
  validateConfig(options: CompletionOptions): void;
}
```

### Configuration Management

Configuration stored in INI format at ~/.ai-shell:

```typescript
const config = await getConfig();
// Returns typed config object with defaults

await setConfigs([['PROVIDER', 'gemini']]);
// Validates and persists to INI file
```

### Error Handling

Use KnownError for user-facing errors:

```typescript
import { KnownError, handleCliError } from './helpers/error';

if (!isValid) {
  throw new KnownError(i18n.t('Invalid input'));
}

// In CLI handlers
try {
  await operation();
} catch (error) {
  handleCliError(error);
  process.exit(1);
}
```

## Configuration Variables

Stored in ~/.ai-shell INI file:

```ini
# Provider selection
PROVIDER=gemini  # Options: gemini, openai, ollama

# API Keys
GEMINI_KEY=your_key_here
OPENAI_KEY=your_key_here

# Provider-specific settings
OLLAMA_HOST=http://localhost:11434
OPENAI_API_ENDPOINT=https://api.openai.com/v1

# Application settings
MODEL=gpt-4o-mini
SILENT_MODE=false
LANGUAGE=en
```

## CLI Commands

### Main Usage
```bash
ai <prompt>              # Single-prompt mode
ai chat                  # Interactive chat mode
ai config                # Interactive config UI
ai config set KEY=VALUE  # Set config value
ai config get KEY        # Get config value
ai update                # Update to latest version
```

### Command Flags
```bash
-p, --prompt <text>      # Specify prompt directly
-s, --silent             # Skip explanation output
```

## Testing Strategy

### Test Types
- Unit tests (vitest): Provider logic, config management, utilities
- Integration tests: Provider switching, end-to-end Ollama workflow

### Test Location
```
tests/
├── unit/
│   ├── config.test.ts
│   └── providers/
│       ├── gemini.test.ts
│       └── ollama.test.ts
└── integration/
    ├── provider-switching.test.ts
    └── ollama-e2e.test.ts
```

### Running Tests
```bash
npm test              # Run all tests
npm run typecheck     # TypeScript validation
```

## Git Workflow

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Never commit to main directly
- PRs require review
- All tests must pass before merge

## Active Technologies

### Core Dependencies
- **TypeScript 4.9.5** - Type system
- **Node.js 18+** - Runtime (minimum version)
- **cleye 1.3.2** - CLI argument parsing
- **@clack/prompts** - Interactive CLI prompts
- **i18next 22.4.15** - Internationalization (16 languages)
- **axios 1.3.5** - HTTP client
- **ini 4.0.0** - Config file parsing
- **execa 7.1.1** - Process execution
- **kolorist 1.7.0** - Terminal colors

### AI Providers
- **@google/generative-ai 0.24.1** - Gemini provider
- **openai 6.17.0** - OpenAI provider
- **axios** - Ollama provider (custom implementation)

### Development
- **vitest 3.2.4** - Test framework
- **pkgroll 2.22.0** - Build tool
- **ESLint + Prettier** - Code quality
- **jiti 1.17.0** - TypeScript execution

### Configuration
- INI file at ~/.ai-shell (config persistence)
- Support for custom API endpoints
- URL validation for Ollama host

## Build & Distribution

```bash
npm run build         # Bundle with pkgroll
npm run lint          # Check code quality
npm run lint:fix      # Auto-fix issues
npm run typecheck     # TypeScript validation
```

Binary commands: `ai-shell` and `ai`

## Architecture Principles

### Provider Abstraction
- All AI providers implement CompletionProvider interface
- Factory pattern for provider instantiation
- Validation separated from completion logic
- Stream-based responses for real-time feedback

### Configuration Strategy
- Single source of truth: ~/.ai-shell INI file
- Type-safe parsing with configParsers
- Validation at parse time
- Support for provider-specific settings

### Internationalization
- 16 languages supported via i18next
- All user-facing strings use i18n.t()
- Language selection persisted in config
- Translations in src/locales/*.json

### Error Handling
- KnownError for expected user-facing errors
- handleCliError for consistent error display
- Validation errors throw immediately
- Provider errors wrapped with context

## User Interaction Flow

### Single-Prompt Mode
1. User runs: `ai list all log files`
2. System generates shell command
3. System shows command + explanation
4. User chooses: Run / Revise / Cancel
5. If Run: Execute command and append to shell history
6. If Revise: Get revision prompt and regenerate

### Interactive Chat Mode
1. User runs: `ai chat`
2. System prompts for request
3. Generate and show command
4. User can revise multiple times
5. Exit with Ctrl+C or Cancel

### Config Flow
1. User runs: `ai config`
2. Interactive menu shows current values (obfuscated keys)
3. Select setting to change
4. Validate input
5. Persist to ~/.ai-shell
6. Return to menu (recursive until cancel)

## Adding a New Provider

1. Create src/helpers/providers/newprovider.ts
2. Implement CompletionProvider interface
3. Add validation in validateConfig()
4. Implement generateCompletion() with streaming
5. Add to createProvider() factory in index.ts
6. Add config parser in src/helpers/config.ts
7. Update showConfigUI() for configuration
8. Add unit tests in tests/unit/providers/
9. Update PROVIDER validation list

## Common Utilities

### Stream Handling
- `streamToIterable()` - Convert streams to async iterables
- `streamToString()` - Buffer entire stream to string

### Shell Integration
- `appendToShellHistory()` - Add commands to shell history
- OS detection for shell type (bash, zsh, fish, etc.)

### Validation
- `isValidOllamaHost()` - URL validation for Ollama
- Config parsers with type coercion and defaults
- Provider-specific validateConfig() methods

## Recent Changes (Branch: 002-ollama-polish)
- Added Ollama provider with local model support
- Implemented OLLAMA_HOST configuration with URL validation
- Enhanced provider architecture with CompletionProvider interface
- Added comprehensive test coverage for Ollama integration
- Improved config validation and error handling
