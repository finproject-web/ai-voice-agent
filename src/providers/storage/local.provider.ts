import fs from 'fs/promises';
import path from 'path';
import { IStorageProvider, UploadOptions, UploadResult, DownloadResult } from './storage.interface';
import logger from '../../config/logger';
import config from '../../config';

export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = config.storageLocalPath || './storage';
    this.ensureDirectory();
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('Failed to create storage directory', { error, path: this.basePath });
    }
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const fullPath = this.getFullPath(options.key);
      const dir = path.dirname(fullPath);

      await fs.mkdir(dir, { recursive: true });

      const bodyBuffer = Buffer.isBuffer(options.body) ? options.body : Buffer.from(options.body);
      await fs.writeFile(fullPath, bodyBuffer);

      logger.info('File uploaded to local storage', { key: options.key, size: bodyBuffer.length });

      return {
        key: options.key,
        url: `/storage/${options.key}`,
      };
    } catch (error) {
      logger.error('Failed to upload to local storage', { error, key: options.key });
      throw error;
    }
  }

  async download(key: string): Promise<DownloadResult> {
    try {
      const fullPath = this.getFullPath(key);
      const body = await fs.readFile(fullPath);

      logger.info('File downloaded from local storage', { key });

      return {
        body,
        contentType: 'application/octet-stream',
      };
    } catch (error) {
      logger.error('Failed to download from local storage', { error, key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(key);
      await fs.unlink(fullPath);

      logger.info('File deleted from local storage', { key });
    } catch (error) {
      logger.error('Failed to delete from local storage', { error, key });
      throw error;
    }
  }

  async getPresignedUrl(key: string): Promise<string> {
    // Local storage doesn't support presigned URLs, return direct URL
    return `/storage/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(key);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const searchPath = prefix ? this.getFullPath(prefix) : this.basePath;

      const entries = await fs.readdir(searchPath, { recursive: true });

      for (const entry of entries) {
        const fullPath = path.join(searchPath, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isFile()) {
          const relativePath = path.relative(this.basePath, fullPath);
          files.push(relativePath.replace(/\\/g, '/'));
        }
      }

      logger.info('Listed files from local storage', { count: files.length });

      return files;
    } catch (error) {
      logger.error('Failed to list local storage', { error, prefix });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureDirectory();
      await fs.access(this.basePath);
      logger.info('Local storage connection test successful');
      return true;
    } catch (error) {
      logger.error('Local storage connection test failed', { error });
      return false;
    }
  }
}
