import { IStorageProvider } from './storage.interface';
import { LocalStorageProvider } from './local.provider';
import { S3StorageProvider } from './s3.provider';

export { IStorageProvider, LocalStorageProvider, S3StorageProvider };

export default LocalStorageProvider;
