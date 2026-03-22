import {
  DEFAULT_CONFIG,
  FOCUS_AREAS,
  SUPPORTED_PROVIDERS,
  type ArivConfig,
  type FileSystem,
  type FocusArea,
  type PartialArivConfig,
  type ProcessRunner,
  type ProjectRegistry,
  type ProjectRegistryEntry,
} from '../types.js';

// === XDG Paths ===

const CONFIG_DIR = `${process.env.HOME}/.config/arivcode`;
const GLOBAL_CONFIG_PATH = `${CONFIG_DIR}/config.json`;
const PROJECTS_DIR = `${CONFIG_DIR}/projects`;
const REGISTRY_PATH = `${PROJECTS_DIR}/registry.json`;

// === Name Generator ===

const ADJECTIVES = [
  'brave', 'calm', 'dark', 'eager', 'fair', 'gentle', 'happy', 'keen',
  'light', 'mild', 'neat', 'pale', 'quick', 'rich', 'safe', 'tall',
  'vast', 'warm', 'bold', 'cool', 'deep', 'fine', 'glad', 'hale',
  'idle', 'just', 'kind', 'lean', 'meek', 'noble', 'open', 'prime',
  'rare', 'slim', 'true', 'vivid', 'wise', 'young', 'agile', 'brief',
  'crisp', 'dry', 'even', 'fresh', 'great', 'high', 'iron', 'lucid',
];

const GERUNDS = [
  'dancing', 'flowing', 'glowing', 'humming', 'leaping', 'moving',
  'racing', 'sailing', 'turning', 'waving', 'blazing', 'climbing',
  'drifting', 'fading', 'growing', 'hiding', 'jumping', 'leading',
  'nesting', 'passing', 'rising', 'setting', 'tracing', 'winding',
  'arching', 'bending', 'curving', 'diving', 'falling', 'gaining',
  'hosting', 'joining', 'keeping', 'lifting', 'marking', 'noting',
  'pacing', 'reading', 'soaring', 'tilting', 'urging', 'voicing',
  'walking', 'yielding', 'binding', 'casting', 'drawing', 'earning',
];

const NOUNS = [
  'river', 'mountain', 'forest', 'ocean', 'meadow', 'canyon', 'valley',
  'island', 'desert', 'glacier', 'harbor', 'lagoon', 'summit', 'cliff',
  'stream', 'prairie', 'ridge', 'grove', 'delta', 'basin', 'shore',
  'crater', 'reef', 'dune', 'marsh', 'bluff', 'cove', 'peak', 'field',
  'pond', 'cloud', 'stone', 'ember', 'spark', 'frost', 'bloom', 'shade',
  'trail', 'bridge', 'tower', 'gate', 'haven', 'hollow', 'ledge',
  'pillar', 'spring', 'terrace', 'vista', 'zenith',
];

export function generateProjectName(existingNames: Set<string>): string {
  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const ger = GERUNDS[Math.floor(Math.random() * GERUNDS.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const name = `${adj}-${ger}-${noun}`;
    if (!existingNames.has(name)) return name;
  }
  return `project-${Date.now()}`;
}

// === JSON Helpers ===

async function readJsonFile<T>(fs: FileSystem, path: string): Promise<T | null> {
  try {
    const exists = await fs.exists(path);
    if (!exists) return null;
    const content = await fs.readFile(path);
    return JSON.parse(content);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`Failed to parse config at ${path}: ${err.message}`);
    }
    return null;
  }
}

async function writeJsonFile(fs: FileSystem, path: string, data: unknown): Promise<void> {
  const dir = path.substring(0, path.lastIndexOf('/'));
  await fs.mkdir(dir, { recursive: true });
  await fs.chmod(dir, 0o700);
  await fs.writeFile(path, JSON.stringify(data, null, 2));
  await fs.chmod(path, 0o600);
}

// === Registry ===

export async function loadRegistry(fs: FileSystem): Promise<ProjectRegistry> {
  const registry = await readJsonFile<ProjectRegistry>(fs, REGISTRY_PATH);
  return registry ?? { projects: {} };
}

export async function saveRegistry(fs: FileSystem, registry: ProjectRegistry): Promise<void> {
  await writeJsonFile(fs, REGISTRY_PATH, registry);
}

async function getRemoteUrl(runner: ProcessRunner): Promise<string> {
  try {
    const { stdout } = await runner.exec('git remote get-url origin');
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function findProjectEntry(
  fs: FileSystem,
  runner: ProcessRunner,
  projectDir: string,
): Promise<{ name: string; entry: ProjectRegistryEntry } | null> {
  const registry = await loadRegistry(fs);

  // First: match by absolute path
  for (const [name, entry] of Object.entries(registry.projects)) {
    if (entry.absolutePath === projectDir) {
      return { name, entry };
    }
  }

  // Second: match by remote URL and re-link
  const remoteUrl = await getRemoteUrl(runner);
  if (remoteUrl) {
    for (const [name, entry] of Object.entries(registry.projects)) {
      if (entry.remoteUrl && entry.remoteUrl === remoteUrl) {
        entry.absolutePath = projectDir;
        await saveRegistry(fs, registry);
        return { name, entry };
      }
    }
  }

  return null;
}

export async function registerProject(
  fs: FileSystem,
  runner: ProcessRunner,
  projectDir: string,
): Promise<string> {
  const registry = await loadRegistry(fs);
  const existingNames = new Set(Object.keys(registry.projects));
  const name = generateProjectName(existingNames);
  const remoteUrl = await getRemoteUrl(runner);

  registry.projects[name] = { absolutePath: projectDir, remoteUrl };
  await saveRegistry(fs, registry);
  return name;
}

// === Config Loading / Saving ===

export async function loadConfig(
  fs: FileSystem,
  runner?: ProcessRunner,
  projectDir?: string,
): Promise<ArivConfig> {
  const globalConfig = await readJsonFile<PartialArivConfig>(fs, GLOBAL_CONFIG_PATH);

  let projectConfig: PartialArivConfig | null = null;
  if (projectDir && runner) {
    const found = await findProjectEntry(fs, runner, projectDir);
    if (found) {
      projectConfig = await readJsonFile<PartialArivConfig>(
        fs,
        `${PROJECTS_DIR}/${found.name}.json`,
      );
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...(globalConfig ?? {}),
    ...(projectConfig ?? {}),
  } as ArivConfig;
}

export async function saveConfig(
  fs: FileSystem,
  config: PartialArivConfig,
  scope: 'project' | 'global',
  projectDir?: string,
  runner?: ProcessRunner,
): Promise<void> {
  if (scope === 'global') {
    await writeJsonFile(fs, GLOBAL_CONFIG_PATH, config);
    return;
  }

  if (!projectDir || !runner) {
    throw new Error('projectDir and runner are required for project-scope config');
  }

  let found = await findProjectEntry(fs, runner, projectDir);
  if (!found) {
    const name = await registerProject(fs, runner, projectDir);
    const registry = await loadRegistry(fs);
    found = { name, entry: registry.projects[name] };
  }

  await writeJsonFile(fs, `${PROJECTS_DIR}/${found.name}.json`, config);
}

// === Validation ===

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

  if (!config.focusAreas || config.focusAreas.length === 0) {
    errors.push('at least one focus area is required');
  } else {
    const invalid = config.focusAreas.filter(
      (a) => !(FOCUS_AREAS as readonly string[]).includes(a),
    );
    if (invalid.length > 0) {
      errors.push(`invalid focus areas: ${invalid.join(', ')}`);
    }
  }

  return errors;
}
