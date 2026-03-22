import fs from 'node:fs/promises';
import type { FileSystem } from '../types.js';

export function createNodeFs(): FileSystem {
  return {
    readFile: (path: string) => fs.readFile(path, 'utf-8'),
    writeFile: (path: string, content: string) => fs.writeFile(path, content, 'utf-8'),
    exists: async (path: string) => {
      try {
        await fs.access(path);
        return true;
      } catch {
        return false;
      }
    },
    unlink: (path: string) => fs.unlink(path),
    mkdir: (path: string, options?: { recursive?: boolean }) =>
      fs.mkdir(path, options).then(() => {}),
    chmod: (path: string, mode: number) => fs.chmod(path, mode),
  };
}
