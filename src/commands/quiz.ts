import chalk from 'chalk';
import type {
  ConfigStore,
  FileSystem,
  GitClient,
  LLMClient,
  Logger,
  QuizPresenter,
  QuizResult,
} from '../types.js';
import { validateConfig } from '../core/config.js';
import { extractPathsFromDiff } from '../core/git.js';
import { getQuestionCount, scoreQuiz, shouldSkipQuiz } from '../core/quiz-engine.js';

export interface QuizOptions {
  skip?: boolean;
}

export interface QuizDeps {
  configStore: ConfigStore;
  gitClient: GitClient;
  llmClient: LLMClient;
  presenter: QuizPresenter;
  logger: Logger;
  options: QuizOptions;
  fs: FileSystem;
  projectDir: string;
}

const ERROR_PATTERNS: Array<{ keywords: string[]; message: string }> = [
  {
    keywords: ['401', 'Unauthorized', 'API key'],
    message: 'Invalid API key. Run `arivcode init` to reconfigure.',
  },
  {
    keywords: ['429', 'rate limit', 'Rate limit'],
    message: 'Rate limited by the API. Please wait a moment and try again.',
  },
  {
    keywords: ['ENOTFOUND', 'ECONNREFUSED', 'fetch failed'],
    message: 'Network error. Check your internet connection and try again.',
  },
];

function handleQuizError(error: unknown, logger: Logger): void {
  logger.stopSpinner(false);

  if (error instanceof Error && error.name === 'ExitPromptError') {
    logger.warn('Quiz cancelled.');
    return;
  }

  if (!(error instanceof Error)) {
    logger.error('An unexpected error occurred.');
    return;
  }

  const msg = error.message;
  const matched = ERROR_PATTERNS.find((p) => p.keywords.some((k) => msg.includes(k)));
  if (matched) {
    logger.error(matched.message);
  } else {
    logger.error(`Quiz generation failed: ${msg}`);
  }
}

function divider(char = '─', width = 50): string {
  return char.repeat(width);
}

function reportResults(result: QuizResult): number {
  console.log();
  console.log(chalk.dim(divider('═')));
  console.log(chalk.bold('  QUIZ RESULTS'));
  console.log(chalk.dim(divider('─')));

  const scoreColor = result.passed ? chalk.green : chalk.red;
  console.log(
    '  Score: ' +
      scoreColor.bold(result.correct + '/' + result.total) +
      ' (' +
      scoreColor(result.percentage + '%') +
      ')',
  );

  const wrongAnswers = result.details.filter((d) => !d.isCorrect);
  if (wrongAnswers.length > 0) {
    console.log();
    console.log(chalk.bold('  Incorrect Answers:'));
    for (const detail of wrongAnswers) {
      console.log(chalk.dim(`  ${divider('─', 46)}`));
      console.log(`  ${chalk.white(detail.question)}`);
      console.log(`    Your answer: ${chalk.red(detail.userAnswer)}`);
      console.log(`    Correct:     ${chalk.green(detail.correctAnswer)}`);
      console.log(`    ${chalk.dim(detail.explanation)}`);
    }
  }

  console.log(chalk.dim(divider('═')));

  if (result.passed) {
    console.log(chalk.green.bold('  ✔ Quiz passed! Commit allowed.'));
    return 0;
  }
  console.log(chalk.red.bold('  ✗ Quiz failed. Go read the diff and try again.'));
  return 1;
}

async function writeScoreFile(
  fs: FileSystem,
  projectDir: string,
  percentage: number,
): Promise<void> {
  const scorePath = `${projectDir}/.git/ARIVCODE_SCORE`;
  await fs.writeFile(scorePath, `arivcode ✓ ${percentage}%`);
}

async function deleteScoreFile(fs: FileSystem, projectDir: string): Promise<void> {
  const scorePath = `${projectDir}/.git/ARIVCODE_SCORE`;
  const exists = await fs.exists(scorePath);
  if (exists) {
    await fs.unlink(scorePath);
  }
}

export async function runQuiz(deps: QuizDeps): Promise<number> {
  const { configStore, gitClient, llmClient, presenter, logger, options, fs, projectDir } = deps;

  if (options.skip) {
    logger.info('Quiz skipped via --skip flag.');
    return 0;
  }

  try {
    const config = await configStore.loadConfig();

    const errors = validateConfig(config);
    if (errors.length > 0) {
      logger.error(`Invalid config: ${errors.join(', ')}`);
      return 1;
    }

    const diff = await gitClient.getDiff();

    if (!diff.raw || diff.linesChanged === 0) {
      logger.info('No staged changes found, nothing to quiz on. Exiting — no staged changes.');
      return 0;
    }

    if (shouldSkipQuiz(diff.linesChanged, config.minLines)) {
      logger.info(
        `Only ${diff.linesChanged} lines changed (threshold: ${config.minLines}). Quiz skip — too few changes.`,
      );
      return 0;
    }

    const questionCount = getQuestionCount(diff.linesChanged);
    const repoTree = await gitClient.getRepoTree();
    const touchedPaths = extractPathsFromDiff(diff.raw);
    const touchedFileContents = await gitClient.getFileContents(touchedPaths);

    const context = { diff: diff.raw, repoTree, touchedFileContents, questionCount };

    logger.startSpinner('Generating quiz questions...');
    const quizResponse = await llmClient.generateQuiz(context, config);
    logger.stopSpinner(true, 'Questions generated!');

    const answers = await presenter.presentQuiz(quizResponse.questions);
    const result = scoreQuiz(quizResponse.questions, answers, config.passingScore);

    const exitCode = reportResults(result);

    if (exitCode === 0 && config.scoreInCommitMessage) {
      await writeScoreFile(fs, projectDir, result.percentage);
    } else {
      await deleteScoreFile(fs, projectDir);
    }

    return exitCode;
  } catch (error: unknown) {
    handleQuizError(error, logger);
    return 1;
  }
}
