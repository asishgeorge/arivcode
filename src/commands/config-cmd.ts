import {
  DEFAULT_CONFIG,
  FOCUS_AREAS,
  SUPPORTED_PROVIDERS,
  type ArivConfig,
  type ConfigStore,
  type Logger,
  type PartialArivConfig,
} from '../types.js';

export interface ConfigSetDeps {
  key: string;
  value: string;
  configStore: ConfigStore;
  logger: Logger;
  scope: 'project' | 'global';
}

const VALID_KEYS = Object.keys(DEFAULT_CONFIG).filter((k) => k !== 'configVersion') as Array<
  keyof Omit<ArivConfig, 'configVersion'>
>;

const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

function coerceValue(key: keyof ArivConfig, raw: string): unknown {
  switch (key) {
    case 'provider':
      if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(raw)) {
        throw new Error(`provider must be one of: ${SUPPORTED_PROVIDERS.join(', ')}`);
      }
      return raw;

    case 'apiKey':
    case 'model':
      return raw;

    case 'difficulty':
      if (!VALID_DIFFICULTIES.includes(raw)) {
        throw new Error(`difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}`);
      }
      return raw;

    case 'minLines': {
      const n = Number(raw);
      if (isNaN(n) || n < 1) throw new Error('minLines must be a positive number');
      return n;
    }

    case 'passingScore': {
      const n = Number(raw);
      if (isNaN(n) || n < 0 || n > 100) throw new Error('passingScore must be between 0 and 100');
      return n;
    }

    case 'focusAreas': {
      const areas = raw.split(',').map((s) => s.trim());
      const invalid = areas.filter((a) => !(FOCUS_AREAS as readonly string[]).includes(a));
      if (invalid.length > 0) {
        throw new Error(
          `invalid focus areas: ${invalid.join(', ')}. Valid: ${FOCUS_AREAS.join(', ')}`,
        );
      }
      return areas;
    }

    case 'scoreInCommitMessage': {
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw new Error('scoreInCommitMessage must be true or false');
    }

    case 'configVersion':
      throw new Error('configVersion cannot be set manually');

    default:
      throw new Error(`unknown config key: ${key}`);
  }
}

export async function runConfigSet(deps: ConfigSetDeps): Promise<number> {
  const { key, value, configStore, logger, scope } = deps;

  if (!VALID_KEYS.includes(key as keyof Omit<ArivConfig, 'configVersion'>)) {
    logger.error(`Unknown config key: ${key}`);
    logger.info(`Valid keys: ${VALID_KEYS.join(', ')}`);
    return 1;
  }

  try {
    const coerced = coerceValue(key as keyof ArivConfig, value);
    const config: PartialArivConfig = { [key]: coerced };
    await configStore.saveConfig(config, scope);
    logger.info(`${key} = ${JSON.stringify(coerced)} (${scope})`);
    return 0;
  } catch (err) {
    logger.error((err as Error).message);
    return 1;
  }
}
