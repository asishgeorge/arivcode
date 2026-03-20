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
  const quizResponse = await llmClient.generateQuiz(context, config);
  const answers = await presenter.presentQuiz(quizResponse.questions);
  const result = scoreQuiz(quizResponse.questions, answers, config.passingScore);

  logger.info(`Score: ${result.correct}/${result.total} (${result.percentage}%)`);

  if (result.passed) {
    logger.info('Quiz passed! Commit allowed.');
    return 0;
  } else {
    logger.error('Quiz failed. Go read the diff and try again.');
    for (const detail of result.details) {
      if (!detail.isCorrect) {
        logger.info(
          `  ✗ ${detail.question}\n    Your answer: ${detail.userAnswer} | Correct: ${detail.correctAnswer}\n    ${detail.explanation}`,
        );
      }
    }
    return 1;
  }
}
