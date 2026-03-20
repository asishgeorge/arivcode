# Ariv Code — MVP Execution Plan

## What It Is
An open-source npm package / CLI tool that quizzes developers on their code changes before committing — ensuring they understand what they're shipping, not just blindly committing AI-generated code.

## How It Works
1. Developer installs `arivcode` globally or in a project
2. Configures OpenRouter API key + preferences (language, difficulty)
3. Developer writes code (or vibe-codes with Cursor/Claude)
4. Developer commits → pre-commit hook fires
5. Tool reads the git diff — if changes are <10 lines, commit passes automatically
6. If ≥10 lines changed, tool sends diff to LLM via OpenRouter
7. LLM generates 3-5 quiz questions about the code changes
8. Developer answers in the terminal (interactive CLI)
9. Score ≥80% → commit passes ✅
10. Score <80% → commit blocked ❌ — "Go read the diff."

Also works as standalone: `arivcode quiz` (quizzes on current staged changes without blocking)

---

## Tech Stack
- **TypeScript** (Node.js)
- **OpenRouter API** (user provides their own key — any model)
- **Git** (reading diffs, pre-commit hook)
- **Inquirer.js** or **Prompts** (interactive CLI quiz UI)
- **Commander.js** (CLI argument parsing)
- **Published on npm** as `arivcode`

---

## MVP Feature Scope (and nothing more)

### In Scope ✅
- `arivcode init` — setup wizard: API key, model preference, difficulty, min lines threshold
- `arivcode hook install` — auto-installs git pre-commit hook
- `arivcode hook uninstall` — removes the hook
- `arivcode quiz` — manual quiz on current staged diff
- Config stored in `.arivcode.json` in project root (or `~/.arivcode/config.json` global)
- Reads `git diff --staged` for changed code
- Skips quiz if diff is <10 lines (configurable threshold)
- Sends diff + context to OpenRouter with structured prompt
- Parses LLM response into multiple-choice or short-answer questions
- Interactive terminal quiz (3-5 questions)
- Scores answers, shows results
- Pass (≥80%) = allow commit / fail (<80%) = block commit + show explanation
- `arivcode skip` flag or `--no-quiz` for emergency commits
- Basic README with install instructions, config options, and usage

### Out of Scope (Phase 2 / Backlog) ❌
- Web dashboard
- Question history / sync
- Built-in API key (Ariv-hosted)
- Team features
- CI/CD integration (GitHub Actions)
- Multiple LLM provider SDKs (everything goes through OpenRouter)
- Analytics or tracking

---

## Config File Example (.arivcode.json)
```json
{
  "openRouterApiKey": "sk-or-...",
  "model": "anthropic/claude-3-haiku",
  "difficulty": "intermediate",
  "language": "typescript",
  "minLines": 10,
  "questionsPerQuiz": 4,
  "passingScore": 80
}
```

---

## LLM Prompt Design (Core of the Product)

System prompt:
```
You are a code review quiz generator. Given a git diff, generate {n} multiple-choice questions 
that test whether the developer truly understands the changes they made.

Rules:
- Questions must be specific to THIS diff, not general programming knowledge
- Test understanding of: what the code does, why it was changed, potential edge cases, 
  and how it connects to the surrounding codebase
- Each question has 4 options (A-D) with exactly 1 correct answer
- Include a brief explanation for the correct answer
- Difficulty level: {difficulty}
- Code language: {language}

Respond ONLY in this JSON format:
{
  "questions": [
    {
      "question": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "B",
      "explanation": "..."
    }
  ]
}
```

---

## Execution Plan — Next Week

### Monday (2 hrs) — Scaffold + Git Diff Reader
- [ ] `npm init` — set up TypeScript project with tsconfig, eslint, prettier
- [ ] Set up Commander.js CLI structure with subcommands: `init`, `quiz`, `hook`
- [ ] Build the git diff reader: execute `git diff --staged`, parse output
- [ ] Add line-count logic: count changed lines, skip if below threshold
- [ ] Test: stage some changes, run the tool, see the diff output in terminal
- **Checkpoint:** `arivcode quiz` reads and displays staged diff ✓

### Tuesday (2 hrs) — LLM Integration + Quiz Generation
- [ ] Build OpenRouter API client (simple fetch wrapper)
- [ ] Design and test the quiz generation prompt
- [ ] Parse LLM JSON response into quiz objects
- [ ] Handle errors: bad API key, rate limits, malformed responses
- [ ] Test: stage code → tool generates real questions about it
- **Checkpoint:** tool generates relevant questions from a diff ✓

### Wednesday (2 hrs) — Interactive Quiz + Scoring
- [ ] Build interactive terminal quiz using Inquirer.js
- [ ] Display questions one at a time, collect answers
- [ ] Score answers, calculate percentage
- [ ] Display results: score, pass/fail, explanations for wrong answers
- [ ] Handle pass (exit 0) and fail (exit 1) for pre-commit hook compatibility
- [ ] Test: full flow from diff → questions → answers → score
- **Checkpoint:** complete quiz flow works in terminal ✓

### Thursday (1.5 hrs) — Pre-commit Hook + Config + Polish
- [ ] Build `arivcode init` wizard (prompts for API key, model, difficulty, language)
- [ ] Save config to `.arivcode.json`
- [ ] Build `arivcode hook install` — writes pre-commit hook to `.git/hooks/pre-commit`
- [ ] Build `arivcode hook uninstall` — removes it
- [ ] Add `--skip` or `--no-quiz` flag for emergency bypasses
- [ ] Add proper error messages, loading spinners, colored output
- [ ] Test full flow: install hook → write code → commit → quiz → pass/fail
- **Checkpoint:** end-to-end pre-commit hook flow works ✓

### Friday (1.5 hrs) — README + npm Publish + Video
- [ ] Write README.md: what it is, why, install, config, usage, screenshots/GIFs
- [ ] Add LICENSE (MIT)
- [ ] Publish to npm: `npm publish`
- [ ] Create GitHub repo with proper description, tags, topics
- [ ] Record video OR schedule recording for Saturday
- **Checkpoint:** package live on npm, repo public on GitHub ✓

### Saturday (1-2 hrs) — Record + Edit + Publish Video
- [ ] Record: demo the tool live + architecture walkthrough
- [ ] Edit: keep it tight, 5-8 min
- [ ] Create thumbnail
- [ ] Write description + tags
- [ ] Upload + publish
- [ ] Cut 1 short: screen recording of quiz blocking a commit
- **Checkpoint:** video published ✓

---

## Video Script — Triplet Bullet Outline

### Format: "I Built X"

### 1. HOOK (30 sec)
- I built a tool that quizzes you on your code before you can commit it
- It's an open source npm package — you install it, connect your own LLM, and it reads your git diff and asks you questions about what you're shipping
- If you're vibe-coding with Cursor or Claude and committing code you don't fully understand — this tool catches that

### 2. THE PROBLEM (45 sec)
- AI coding tools are incredible — but there's a growing problem: developers are shipping code they can't explain
- You paste a prompt, AI gives you 50 lines, you commit it, it works — but if something breaks at 2am, can you actually debug it?
- I built this because I caught myself doing exactly that — and I wanted a forcing function to actually learn what I'm committing

### 3. THE DEMO (90 sec)
- Show installing: `npm install -g arivcode`
- Show init: `arivcode init` — configure API key, language, difficulty
- Show hook install: `arivcode hook install`
- Write or generate some code with Cursor/AI
- Try to commit → quiz appears in terminal
- Answer questions → pass → commit goes through
- Show a fail scenario → commit blocked → "Go read the diff"

### 4. HOW IT WORKS — ARCHITECTURE (60 sec)
- Walk through the flow: git diff → line count check → OpenRouter API → structured prompt → JSON quiz → interactive CLI → score → exit code
- Why OpenRouter: lets users pick any model, no vendor lock-in
- The prompt engineering: questions must be specific to THIS diff, not generic programming trivia
- Pre-commit hook mechanics: exit 0 = pass, exit 1 = block

### 5. KEY DECISIONS (45 sec)
- Why 10 lines minimum: don't annoy people for one-line fixes
- Why 80% threshold: strict enough to matter, not so strict it's unusable
- Why OpenRouter over direct API: one integration, any model
- Why npm package: lowest friction for JS/TS developers, expandable later

### 6. WHAT'S NEXT (30 sec)
- Phase 2: web dashboard that syncs your quiz history — track what you're learning over time
- The CLI stays free and open source forever
- Try it: link in the description, star the repo, let me know what you'd change

### 7. CLOSE (15 sec)
- If you're vibe-coding, this is your safety net
- Subscribe for more tools I build — and link to try it yourself

---

## Title Options
- "I Built a Tool That Quizzes You Before You Can Commit Code"
- "Stop Shipping Code You Don't Understand (I Built a Fix)"
- "This CLI Tool Tests If You Actually Understand Your AI-Generated Code"
- "I Built an Open Source Tool to Fix the Vibe Coding Problem"

## Thumbnail Concepts
- Terminal screenshot showing quiz blocking a commit + "COMMIT BLOCKED" in red
- Split: Cursor/AI on one side → quiz in terminal on the other
- Your face + "Do you even understand your code?"

## Short (from this video)
- 30 sec screen recording: commit → quiz appears → fail → "COMMIT REJECTED" → cut to black
- Text overlay: "Stop shipping code you can't explain"

---

## Done =
1. `arivcode` live on npm ✓
2. GitHub repo public with README ✓
3. Pre-commit hook + standalone quiz both working ✓
4. Video published on YouTube ✓
5. 1 short published ✓

---

## BACKLOG (do NOT touch next week)
- Web dashboard
- Question history sync
- Ariv-hosted API key
- GitHub Action / CI integration
- RAG resume chatbot (moved from this week)