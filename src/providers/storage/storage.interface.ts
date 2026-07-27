export interface UploadOptions {
  key: string;
  body: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
}

export interface DownloadResult {
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface IStorageProvider {
  /**
   * Upload a file
   */
  upload(options: UploadOptions): Promise<UploadResult>;

  /**
   * Download a file
   */
  download(key: string): Promise<DownloadResult>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<void>;

  /**
   * Get a presigned URL for download
   */
  getPresignedUrl(key: string): Promise<string>;

  /**
   * Check if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * List files with prefix
   */
  list(prefix?: string): Promise<string[]>;

  /**
   * Test provider connection
   */
  testConnection(): Promise<boolean>;
}
