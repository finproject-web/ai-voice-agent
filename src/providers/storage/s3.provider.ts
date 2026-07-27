import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageProvider, UploadOptions, UploadResult, DownloadResult } from './storage.interface';
import logger from '../../config/logger';
import config from '../../config';

export class S3StorageProvider implements IStorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.awsRegion || !config.awsS3Bucket) {
      throw new Error('AWS S3 credentials not configured');
    }

    this.client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });

    this.bucket = config.awsS3Bucket;
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      const response = await this.client.send(command);

      logger.info('File uploaded to S3', { key: options.key, bucket: this.bucket });

      return {
        key: options.key,
        url: `s3://${this.bucket}/${options.key}`,
        etag: response.ETag,
      };
    } catch (error) {
      logger.error('Failed to upload to S3', { error, key: options.key });
      throw error;
    }
  }

  async download(key: string): Promise<DownloadResult> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new Error('No body in response');
      }

      const body = await response.Body.transformToByteArray();
      const buffer = Buffer.from(body);

      logger.info('File downloaded from S3', { key, bucket: this.bucket });

      return {
        body: buffer,
        contentType: response.ContentType || 'application/octet-stream',
        metadata: response.Metadata as Record<string, string>,
      };
    } catch (error) {
      logger.error('Failed to download from S3', { error, key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      logger.info('File deleted from S3', { key, bucket: this.bucket });
    } catch (error) {
      logger.error('Failed to delete from S3', { error, key });
      throw error;
    }
  }

  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      logger.info('Presigned URL generated for S3', { key, expiresIn });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned URL for S3', { error, key });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
      });

      const response = await this.client.send(command);

      const keys = response.Contents?.map((obj) => obj.Key || '').filter(Boolean) || [];

      logger.info('Listed files from S3', { count: keys.length, prefix });

      return keys;
    } catch (error) {
      logger.error('Failed to list S3', { error, prefix });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        MaxKeys: 1,
      });

      await this.client.send(command);
      logger.info('S3 connection test successful');
      return true;
    } catch (error) {
      logger.error('S3 connection test failed', { error });
      return false;
    }
  }
}
