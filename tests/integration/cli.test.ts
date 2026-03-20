import { describe, it, expect } from 'vitest';
import { createCli } from '../../src/cli.js';

describe('cli', () => {
  it('registers quiz command', () => {
    const program = createCli();
    const quiz = program.commands.find((c) => c.name() === 'quiz');
    expect(quiz).toBeDefined();
  });

  it('registers init command', () => {
    const program = createCli();
    const init = program.commands.find((c) => c.name() === 'init');
    expect(init).toBeDefined();
  });

  it('registers hook command with install and uninstall subcommands', () => {
    const program = createCli();
    const hook = program.commands.find((c) => c.name() === 'hook');
    expect(hook).toBeDefined();
    const install = hook!.commands.find((c) => c.name() === 'install');
    const uninstall = hook!.commands.find((c) => c.name() === 'uninstall');
    expect(install).toBeDefined();
    expect(uninstall).toBeDefined();
  });

  it('quiz command has --skip option', () => {
    const program = createCli();
    const quiz = program.commands.find((c) => c.name() === 'quiz');
    const skipOption = quiz!.options.find((o) => o.long === '--skip');
    expect(skipOption).toBeDefined();
  });

  it('init command has --global option', () => {
    const program = createCli();
    const init = program.commands.find((c) => c.name() === 'init');
    const globalOption = init!.options.find((o) => o.long === '--global');
    expect(globalOption).toBeDefined();
  });

  it('has correct version', () => {
    const program = createCli();
    expect(program.version()).toBe('0.1.0');
  });
});
