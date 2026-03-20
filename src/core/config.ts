import {
  DEFAULT_CONFIG,
  SUPPORTED_PROVIDERS,
  type ArivConfig,
  type FileSystem,
  type PartialArivConfig,
} from '../types.js';

const GLOBAL_CONFIG_PATH = `${process.env.HOME}/.arivcode/config.json`;
const PROJECT_CONFIG_NAME = '.arivcode.json';

async function readJsonFile(fs: FileSystem, path: string): Promise<PartialArivConfig> {
  try {
    const exists = await fs.exists(path);
    if (!exists) return {};
    const content = await fs.readFile(path);
    return JSON.parse(content);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse config at ${path}: ${err.message}`);
    }
    // File doesn't exist or other read error — treat as empty
    return {};
  }
}

export async function loadConfig(
  fs: FileSystem,
  projectDir?: string,
): Promise<ArivConfig> {
  const globalConfig = await readJsonFile(fs, GLOBAL_CONFIG_PATH);
  const projectConfig = projectDir
    ? await readJsonFile(fs, `${projectDir}/${PROJECT_CONFIG_NAME}`)
    : {};

  return {
    ...DEFAULT_CONFIG,
    ...globalConfig,
    ...projectConfig,
  } as ArivConfig;
}

export async function saveConfig(
  fs: FileSystem,
  config: PartialArivConfig,
  scope: 'project' | 'global',
  projectDir?: string,
): Promise<void> {
  const path =
    scope === 'global'
      ? GLOBAL_CONFIG_PATH
      : `${projectDir}/${PROJECT_CONFIG_NAME}`;

  const dir = path.substring(0, path.lastIndexOf('/'));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path, JSON.stringify(config, null, 2));
}

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export function validateConfig(config: ArivConfig): string[] {
  const errors: string[] = [];

  if (!config.apiKey) {
    errors.push('apiKey is required');
  }

  if (!SUPPORTED_PROVIDERS.includes(config.provider)) {
    errors.push(`provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`);
  }

  if (!(VALID_DIFFICULTIES as readonly string[]).includes(config.difficulty)) {
    errors.push(`difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`);
  }

  if (config.passingScore < 0 || config.passingScore > 100) {
    errors.push('passingScore must be between 0 and 100');
  }

  return errors;
}
