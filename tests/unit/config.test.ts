import { describe, it, expect } from 'vitest';
import {
  loadConfig,
  saveConfig,
  validateConfig,
  generateProjectName,
  loadRegistry,
  findProjectEntry,
  registerProject,
} from '../../src/core/config.js';
import type { FileSystem, PartialArivConfig, ProcessRunner } from '../../src/types.js';
import { DEFAULT_CONFIG } from '../../src/types.js';

const CONFIG_DIR = `${process.env.HOME}/.config/arivcode`;
const GLOBAL_PATH = `${CONFIG_DIR}/config.json`;
const REGISTRY_PATH = `${CONFIG_DIR}/projects/registry.json`;

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

function createMockRunner(remoteUrl = 'https://github.com/user/repo.git'): ProcessRunner {
  return {
    exec: async (cmd: string) => {
      if (cmd === 'git remote get-url origin') {
        return { stdout: remoteUrl + '\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    },
  };
}

describe('config', () => {
  describe('loadConfig', () => {
    it('returns DEFAULT_CONFIG when no config files exist', async () => {
      const fs = createMockFs();
      const config = await loadConfig(fs);
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('reads global config from ~/.config/arivcode/config.json', async () => {
      const globalConfig: PartialArivConfig = {
        apiKey: 'sk-global',
        model: 'gpt-4o',
      };
      const fs = createMockFs({
        [GLOBAL_PATH]: JSON.stringify(globalConfig),
      });
      const config = await loadConfig(fs);
      expect(config.apiKey).toBe('sk-global');
      expect(config.model).toBe('gpt-4o');
      expect(config.difficulty).toBe('intermediate');
    });

    it('merges project config over global config over defaults', async () => {
      const runner = createMockRunner();
      const files: Record<string, string> = {};
      const fs = createMockFs(files);

      // Register a project first
      const name = await registerProject(fs, runner, '/project');

      // Write global and project configs
      files[GLOBAL_PATH] = JSON.stringify({ apiKey: 'sk-global', model: 'gpt-4o' });
      files[`${CONFIG_DIR}/projects/${name}.json`] = JSON.stringify({ minLines: 20 });

      const config = await loadConfig(fs, runner, '/project');
      expect(config.apiKey).toBe('sk-global');
      expect(config.model).toBe('gpt-4o');
      expect(config.minLines).toBe(20);
      expect(config.difficulty).toBe('intermediate');
    });

    it('throws readable error for malformed JSON', async () => {
      const fs = createMockFs({
        [GLOBAL_PATH]: '{ not valid json',
      });
      await expect(loadConfig(fs)).rejects.toThrow(/Failed to parse/);
    });
  });

  describe('saveConfig', () => {
    it('writes config to global path when scope is global', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      const config: PartialArivConfig = { apiKey: 'sk-test' };
      await saveConfig(fs, config, 'global');
      expect(files[GLOBAL_PATH]).toBeDefined();
      expect(JSON.parse(files[GLOBAL_PATH])).toEqual(config);
    });

    it('writes config to project file in XDG projects dir', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      const runner = createMockRunner();
      const config: PartialArivConfig = { apiKey: 'sk-test', model: 'gpt-4o' };
      await saveConfig(fs, config, 'project', '/project', runner);

      // Check that a project was registered
      const registry = await loadRegistry(fs);
      const names = Object.keys(registry.projects);
      expect(names).toHaveLength(1);

      // Check that config was written
      const projectFile = `${CONFIG_DIR}/projects/${names[0]}.json`;
      expect(files[projectFile]).toBeDefined();
      expect(JSON.parse(files[projectFile])).toEqual(config);
    });

    it('pretty-prints JSON with 2-space indent', async () => {
      const files: Record<string, string> = {};
      const fs = createMockFs(files);
      await saveConfig(fs, { apiKey: 'sk-test' }, 'global');
      expect(files[GLOBAL_PATH]).toBe(JSON.stringify({ apiKey: 'sk-test' }, null, 2));
    });

    it('throws when project scope used without runner', async () => {
      const fs = createMockFs();
      await expect(
        saveConfig(fs, { apiKey: 'sk-test' }, 'project', '/project'),
      ).rejects.toThrow(/runner/);
    });
  });

  describe('generateProjectName', () => {
    it('generates a three-word hyphenated name', () => {
      const name = generateProjectName(new Set());
      const parts = name.split('-');
      expect(parts).toHaveLength(3);
    });

    it('avoids collisions with existing names', () => {
      const existing = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const name = generateProjectName(existing);
        expect(existing.has(name)).toBe(false);
        existing.add(name);
      }
    });
  });

  describe('registry', () => {
    it('loadRegistry returns empty projects when no registry exists', async () => {
      const fs = createMockFs();
      const registry = await loadRegistry(fs);
      expect(registry.projects).toEqual({});
    });

    it('registerProject creates a new entry in the registry', async () => {
      const fs = createMockFs();
      const runner = createMockRunner('https://github.com/user/repo.git');
      const name = await registerProject(fs, runner, '/my/project');

      const registry = await loadRegistry(fs);
      expect(registry.projects[name]).toBeDefined();
      expect(registry.projects[name].absolutePath).toBe('/my/project');
      expect(registry.projects[name].remoteUrl).toBe('https://github.com/user/repo.git');
    });

    it('findProjectEntry matches by absolute path', async () => {
      const fs = createMockFs();
      const runner = createMockRunner();
      await registerProject(fs, runner, '/my/project');

      const found = await findProjectEntry(fs, runner, '/my/project');
      expect(found).not.toBeNull();
      expect(found!.entry.absolutePath).toBe('/my/project');
    });

    it('findProjectEntry re-links when path changes but remote matches', async () => {
      const fs = createMockFs();
      const runner = createMockRunner('https://github.com/user/repo.git');
      const name = await registerProject(fs, runner, '/old/path');

      // Now search from a different path but same remote
      const found = await findProjectEntry(fs, runner, '/new/path');
      expect(found).not.toBeNull();
      expect(found!.name).toBe(name);

      // Verify re-link happened
      const registry = await loadRegistry(fs);
      expect(registry.projects[name].absolutePath).toBe('/new/path');
    });

    it('findProjectEntry returns null when no match', async () => {
      const fs = createMockFs();
      const runner = createMockRunner('https://github.com/user/other.git');
      await registerProject(fs, createMockRunner('https://github.com/user/repo.git'), '/project');

      const found = await findProjectEntry(fs, runner, '/different');
      expect(found).toBeNull();
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

    it('returns errors for empty focusAreas', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, apiKey: 'sk-valid', focusAreas: [] });
      expect(errors.some((e) => e.includes('focus area'))).toBe(true);
    });

    it('returns errors for invalid focusAreas values', () => {
      const errors = validateConfig({
        ...DEFAULT_CONFIG,
        apiKey: 'sk-valid',
        focusAreas: ['invalid' as any],
      });
      expect(errors.some((e) => e.includes('invalid focus'))).toBe(true);
    });

    it('returns empty array for valid config', () => {
      const errors = validateConfig({ ...DEFAULT_CONFIG, apiKey: 'sk-valid' });
      expect(errors).toEqual([]);
    });
  });
});
