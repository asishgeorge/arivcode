import { exec as cpExec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProcessRunner } from '../types.js';

const execAsync = promisify(cpExec);

export function createNodeProcessRunner(): ProcessRunner {
  return {
    exec: async (command: string) => {
      const { stdout, stderr } = await execAsync(command);
      return { stdout, stderr };
    },
  };
}
