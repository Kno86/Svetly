import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/env.js';

/** Storage abstraction: local volume now, object storage (S3-compatible) can implement the same interface later. */
export interface FileStorage {
  put(data: Buffer, extension: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export const IMAGE_TYPES: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  'image/jpeg': { ext: 'jpg', magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': {
    ext: 'png',
    magic: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    ext: 'webp',
    magic: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = config.mediaDir;
  }

  async put(data: Buffer, extension: string): Promise<string> {
    const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
    await mkdir(join(this.root, key.slice(0, 7)), { recursive: true });
    await writeFile(join(this.root, key), data, { flag: 'wx' });
    return key;
  }

  get(key: string): Promise<Buffer> {
    if (!/^\d{4}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key))
      throw new Error('invalid storage key');
    return readFile(join(this.root, key));
  }

  async remove(key: string): Promise<void> {
    await unlink(join(this.root, key)).catch(() => undefined);
  }
}
