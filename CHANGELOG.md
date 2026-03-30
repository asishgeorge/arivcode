# Changelog

## 0.1.0-alpha.2

### Features

- **Pre-push quiz mode** — new `push` mode lets developers commit freely and only face the quiz before pushing, enabling a flow state during development
- **Mode selection in setup wizard** — `arivcode init` now asks "When should the quiz run?" (every commit or every push) as part of the default flow
- **Mode-aware hook installation** — `arivcode hook install` installs a pre-push hook when mode is `push`, pre-commit when mode is `commit`
- **`--mode` flag for hook install** — override the configured mode with `arivcode hook install --mode push`
- **`arivcode config set mode push`** — switch modes without re-running the setup wizard

### Architecture

- **Strategy-pattern GitClient** — `createGitClient(runner, mode)` encapsulates diff strategy internally; quiz logic has zero branching on mode

## 0.1.0-alpha.1

Initial alpha release.

### Features

- **Pre-commit quiz engine** — generates multiple-choice questions about your staged git diff using an LLM, blocks commits if you score below the passing threshold
- **Multi-provider LLM support** — OpenAI, Google Gemini, and Anthropic Claude via the Vercel AI SDK
- **Interactive CLI** — setup wizard (`arivcode init`), standalone quiz (`arivcode quiz`), and inline config updates (`arivcode config set`)
- **Git hook management** — `arivcode hook install/uninstall` for pre-commit and prepare-commit-msg hooks
- **Dynamic question scaling** — 8 to 20 questions based on diff size
- **3 difficulty levels** — Beginner, Intermediate, Advanced
- **4 focus areas** — Syntax, Execution, Architecture, Edge Cases
- **Per-project and global config** — hierarchical config stored under `~/.config/arivcode/`
- **Score in commit messages** — optionally prepend quiz score to each commit
- **Emergency bypass** — `--skip` flag to bypass the quiz when needed
- **Self-upgrade** — `arivcode upgrade` to update to the latest version
