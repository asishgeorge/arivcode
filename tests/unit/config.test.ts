import { describe, it, expect } from 'vitest';
import { loadConfig, saveConfig, validateConfig } from '../../src/core/config.js';
import type { FileSystem, PartialArivConfig } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

function createMockFs(files: Record<string, string> = {}): FileSystem {
  return {
    readFile: async (path: string) => {
      if (path in files) return files[path];
      throw new Error(`ENOENT: no such file: ${path}`);
    },
    writeFile: async (path: string, content: string) => {
      files[path] = content;
    },
    exists: async (path: string) => path in files,
    unlink: async (path: string) => {
      delete files[path];
    },
    mkdir: async () => {},
  };
}

describe('config', () => {
  describe('loadConfig', () => {
    it('returns DEFAULT_CONFIG when no config files exist', async () => {
      const fs = createMockFs();
      const config = await loadConfig(fs, '/project');
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('reads global config from ~/.arivcode/config.json', async () => {
      const globalConfig: PartialArivConfig = {
        apiKey: 'sk-global',
        model: 'gpt-4o',
      };
      const fs = createMockFs({
        [`${process.env.HOME}/.arivcode/config.json`]: JSON.stringify(globalConfig),
      });
      const config = await loadConfig(fs, '/project');
      expect(config.apiKey).toBe('sk-global');
      expect(config.model).toBe('gpt-4o');
      // defaults still apply for unset fields
      expect(config.difficulty).toBe('intermediate');
    });

    it('reads project config from .arivcode.json in given directory', async () => {
      const projectConfig: PartialArivConfig = {
        language: 'python',
        minLines: 5,
      };
      const fs = createMockFs({
        '/project/.arivcode.json': JSON.stringify(projectConfig),
      });
      const config = await loadConfig(fs, '/project');
      expect(config.language).toBe('python');
      expect(config.minLines).toBe(5);
    });

    it('merges project config over global config over defaults', async () => {
      const globalConfig: PartialArivConfig = {
        apiKey: 'sk-global',
        model: 'gpt-4o',
        language: 'go',
      };
      const projectConfig: PartialArivConfig = {
        language: 'rust',
        minLines: 20,
      };
      const fs = createMockFs({
        [`${process.env.HOME}/.arivcode/config.json`]: JSON.stringify(globalConfig),
        '/project/.arivcode.json': JSON.stringify(projectConfig),
      });
      const config = await loadConfig(fs, '/project');
      expect(config.apiKey).toBe('sk-global'); // from global
      expect(config.model).toBe('gpt-4o'); // from global
      expect(config.language).toBe('rust'); // project overrides global
      expect(config.minLines).toBe(20); // from project
      expect(config.difficulty).toBe('intermediate'); // from defaults
    });

    it('ignores missing project config, uses global + defaults', async () => {
      const globalConfig: PartialArivConfig = { apiKey: 'sk-test' };
      const fs = createMockFs({
        [`${process.env.HOME}/.arivcode/config.json`]: JSON.stringify(globalConfig),
      });
      const config = await loadConfig(fs, '/project');
      expect(config.apiKey).toBe('sk-test');
      expect(config.provider).toBe('openai');
    });

    it('throws readable error for malformed JSON', async () => {
      const fs = createMockFs({
        '/project/.arivcode.json': '{ not valid json',
      });
      await expect(loadConfig(fs, '/project')).rejects.toThrow(/Failed to parse/);
    });
  });

  describe('saveConfig', () => {
    it('writes config to .arivcode.json when scope is project', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      const config: PartialArivConfig = { apiKey: 'sk-test', model: 'gpt-4o' };
      await saveConfig(fs, config, 'project', '/project');
      expect(files['/project/.arivcode.json']).toBeDefined();
      expect(JSON.parse(files['/project/.arivcode.json'])).toEqual(config);
    });

    it('writes config to ~/.arivcode/config.json when scope is global', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      const config: PartialArivConfig = { apiKey: 'sk-test' };
      await saveConfig(fs, config, 'global');
      const globalPath = `${process.env.HOME}/.arivcode/config.json`;
      expect(files[globalPath]).toBeDefined();
      expect(JSON.parse(files[globalPath])).toEqual(config);
    });

    it('pretty-prints JSON with 2-space indent', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      await saveConfig(fs, { apiKey: 'sk-test' }, 'project', '/project');
      const content = files['/project/.arivcode.json'];
      expect(content).toBe(JSON.stringify({ apiKey: 'sk-test' }, null, 2));
    });
  });

  describe('validateConfig', () => {
    it('returns errors for missing apiKey', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, apiKey: '' });
      expect(errors).toContain('apiKey is required');
    });

    it('returns errors for invalid provider', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, provider: 'invalid' as any });
      expect(errors.some((e) => e.includes('provider'))).toBe(true);
    });

    it('returns errors for invalid difficulty value', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, difficulty: 'expert' as any });
      expect(errors.some((e) => e.includes('difficulty'))).toBe(true);
    });

    it('returns errors for passingScore outside 0-100', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, passingScore: 150 });
      expect(errors.some((e) => e.includes('passingScore'))).toBe(true);
    });

    it('returns empty array for valid config', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, apiKey: 'sk-valid' });
      expect(errors).toEqual([]);
    });
  });
});
