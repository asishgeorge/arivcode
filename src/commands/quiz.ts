import type {
  ConfigStore,
  GitClient,
  LLMClient,
  Logger,
  QuizPresenter,
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
}

export async function runQuiz(deps: QuizDeps): Promise<number> {
  const { configStore, gitClient, llmClient, presenter, logger, options } = deps;

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

    const diff = await gitClient.getStagedDiff();

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

    logger.info(`Score: ${result.correct}/${result.total} (${result.percentage}%)`);

    const wrongAnswers = result.details.filter((d) => !d.isCorrect);
    if (wrongAnswers.length > 0) {
      logger.info('\nIncorrect answers:');
      for (const detail of wrongAnswers) {
        logger.info(
          `  ✗ ${detail.question}\n    Your answer: ${detail.userAnswer} | Correct: ${detail.correctAnswer}\n    ${detail.explanation}`,
        );
      }
    }

    if (result.passed) {
      logger.info('Quiz passed! Commit allowed.');
      return 0;
    } else {
      logger.error('Quiz failed. Go read the diff and try again.');
      return 1;
    }
  } catch (error: unknown) {
    logger.stopSpinner(false);

    // Handle user cancellation (Ctrl+C, terminal closed)
    if (error instanceof Error && error.name === 'ExitPromptError') {
      logger.warn('Quiz cancelled.');
      return 1;
    }

    if (error instanceof Error) {
      const msg = error.message;

      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')) {
        logger.error('Invalid API key. Run `arivcode init` to reconfigure.');
        return 1;
      }

      if (msg.includes('429') || msg.includes('rate limit') || msg.includes('Rate limit')) {
        logger.error('Rate limited by the API. Please wait a moment and try again.');
        return 1;
      }

      if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        logger.error('Network error. Check your internet connection and try again.');
        return 1;
      }

      logger.error(`Quiz generation failed: ${msg}`);
    } else {
      logger.error('An unexpected error occurred.');
    }

    return 1;
  }
}
