# arivcode

**Stop shipping code you don't understand.**

A CLI tool that quizzes you on your staged code changes before letting you commit. Built for developers who use AI code generators and want to stay accountable for every line they ship.

[![npm version](https://img.shields.io/npm/v/arivcode)](https://www.npmjs.com/package/arivcode)
[![license](https://img.shields.io/npm/l/arivcode)](LICENSE)
[![node](https://img.shields.io/node/v/arivcode)](package.json)

> **Alpha Release** — arivcode is in early development. Expect rough edges. Feedback and contributions are welcome!

---

## Why arivcode?

AI coding tools like Cursor, Copilot, and Claude generate code fast — but speed without understanding is a liability. Bugs slip through when developers commit code they can't explain.

arivcode adds a simple gate: before your commit goes through, you answer a short quiz about your own changes. Pass the quiz, and the commit proceeds. Fail, and you go back to read the diff.

## How It Works

```
git add .
git commit -m "add feature"
│
├─ arivcode pre-commit hook triggers
├─ reads your staged diff
├─ sends diff to an LLM (OpenAI / Google / Anthropic)
├─ generates multiple-choice questions about YOUR changes
├─ you answer interactively in the terminal
│
├─ score >= 80%  →  commit goes through
└─ score < 80%   →  commit blocked, go read the diff
```

## Quick Start

```bash
# Install globally
npm install -g arivcode

# Run the setup wizard (picks provider, API key, model)
arivcode init

# That's it — make changes, stage, and commit as usual
git add .
git commit -m "my changes"
# → quiz starts automatically if the hook was installed
```

## Features

- **Multi-provider LLM support** — OpenAI, Google Gemini, and Anthropic Claude
- **3 difficulty levels** — Beginner, Intermediate, Advanced
- **4 focus areas** — Syntax, Execution, Architecture, Edge Cases
- **Dynamic question count** — 8 to 20 questions scaled to your diff size
- **Per-project and global config** — different settings for different repos
- **Git hook integration** — pre-commit hook blocks bad commits, prepare-commit-msg appends your score
- **Score in commit messages** — optionally badge each commit with your quiz score
- **Emergency bypass** — `arivcode quiz --skip` when you absolutely must commit now

## Commands

### `arivcode init [--global] [--advanced]`

Interactive setup wizard. Asks for your LLM provider, API key, and model. Use `--advanced` to also configure difficulty, passing score, focus areas, and more. Use `--global` to save config globally instead of per-project.

### `arivcode quiz [--skip]`

Run the quiz on your current staged changes. This is what the pre-commit hook calls. Use `--skip` to bypass the quiz entirely.

### `arivcode hook install`

Installs two git hooks in the current repo:
- **pre-commit** — runs `arivcode quiz` before each commit
- **prepare-commit-msg** — appends quiz score to commit message (if enabled)

### `arivcode hook uninstall`

Removes arivcode-managed git hooks from the current repo.

### `arivcode config set <key> <value> [--global]`

Set a single config value without re-running the full init wizard.

```bash
arivcode config set passingScore 70
arivcode config set difficulty advanced --global
arivcode config set focusAreas "syntax,edge-cases"
```

### `arivcode upgrade`

Upgrade arivcode to the latest version via npm.

## Configuration

Config is loaded in layers — each layer overrides the previous:

```
Defaults → Global config → Project config
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `provider` | `openai` \| `google` \| `anthropic` | `openai` | LLM provider |
| `apiKey` | `string` | — | Your provider API key |
| `model` | `string` | `gpt-5.4-mini` | Model to use for quiz generation |
| `difficulty` | `beginner` \| `intermediate` \| `advanced` | `intermediate` | Quiz difficulty |
| `minLines` | `number` | `10` | Minimum changed lines to trigger a quiz |
| `passingScore` | `number` (0–100) | `80` | Percentage required to pass |
| `focusAreas` | `string[]` | all four | Which question categories to include |
| `scoreInCommitMessage` | `boolean` | `false` | Prepend quiz score to commit messages |

**Config file locations:**
- Global: `~/.config/arivcode/config.json`
- Per-project: `~/.config/arivcode/projects/<project-name>.json`

## Supported Models

### OpenAI
`gpt-5.4` · `gpt-5.4-mini` · `gpt-5.4-nano` · `gpt-4.1` · `gpt-4.1-mini` · `gpt-4.1-nano` · `o3` · `o3-mini` · `o4-mini`

### Google
`gemini-3.1-pro-preview` · `gemini-3-flash-preview` · `gemini-3.1-flash-lite` · `gemini-2.5-pro` · `gemini-2.5-flash`

### Anthropic
`claude-opus-4-6` · `claude-sonnet-4-6` · `claude-sonnet-4-5-20250514` · `claude-haiku-4-5-20251001`

You can also pass any model string your provider supports via `arivcode config set model <model-id>`.

## How Scoring Works

The number of quiz questions scales with your diff size:

| Lines Changed | Questions |
|---------------|-----------|
| 10 – 100 | 8 |
| 101 – 250 | 12 |
| 251 – 500 | 16 |
| 501+ | 20 |

- Changes below the `minLines` threshold (default: 10) skip the quiz entirely.
- You need to score at or above `passingScore` (default: 80%) to pass.
- Each question is multiple choice (A/B/C/D) with an explanation shown after scoring.

## Development

```bash
git clone https://github.com/asishgeorge/arivcode.git
cd arivcode
pnpm install

# Build
pnpm run build

# Run in development (no build needed)
pnpm run dev

# Run tests
pnpm run test
pnpm run test:watch

# Lint & format
pnpm run lint
pnpm run format:check
```

Requires **Node.js 22+** and **pnpm**.

## Architecture

```
src/
├── commands/       CLI command handlers (quiz, init, hook, config)
├── core/           Business logic (config, git, LLM, quiz scoring, prompt building)
├── adapters/       I/O abstractions (filesystem, process runner, terminal UI)
└── types.ts        Interfaces, schemas, and constants

tests/
├── unit/           Core logic tests
└── integration/    Full CLI command tests
```

The codebase follows clean architecture with dependency injection — all external I/O goes through interfaces defined in `types.ts`, making every component independently testable.

## Contributing

Contributions are welcome! This is an alpha release and there's plenty to improve.

1. Fork the repo
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes
4. Run tests (`pnpm run test`) and linting (`pnpm run lint`)
5. Open a pull request

Please open an issue first for large changes so we can discuss the approach.

## License

[MIT](LICENSE)
