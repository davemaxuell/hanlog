import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { assertSafeMediaPath, type MediaStore } from './index';

export function createLocalMediaStore(dir: string): MediaStore {
  const pathFor = (path: string) => { assertSafeMediaPath(path); return resolve(dir, path); };
  return {
    async put(path, bytes) { const destination = pathFor(path); await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes); },
    async get(path) {
      try { return new Uint8Array(await readFile(pathFor(path))); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    },
    async remove(paths) {
      const destinations = paths.map(pathFor);
      for (const destination of destinations) {
        try { await unlink(destination); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
    },
  };
}
