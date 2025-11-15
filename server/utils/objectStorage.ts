import { objectStorageClient, parseObjectPath } from '../objectStorage';
import { logger } from '../logger';
import fetch from 'node-fetch';
import { Readable } from 'stream';

interface UploadToObjectStorageOptions {
  sourceUrl: string;
  destinationPath: string;
  apiKey?: string;
  contentType?: string;
}

export async function uploadToObjectStorage(options: UploadToObjectStorageOptions): Promise<string> {
  const { sourceUrl, destinationPath, apiKey, contentType = 'video/mp4' } = options;
  
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!privateObjectDir) {
    throw new Error(
      'PRIVATE_OBJECT_DIR not set. Create a bucket in Object Storage tool and set PRIVATE_OBJECT_DIR env var.'
    );
  }

  const fullPath = `${privateObjectDir}/${destinationPath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  
  logger.info('Starting video download and upload', { sourceUrl, destinationPath });
  
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-goog-api-key'] = apiKey;
  }
  
  const response = await fetch(sourceUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
  }
  
  if (!response.body) {
    throw new Error('No response body received from video source');
  }
  
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);
  
  // Stream video directly to object storage without buffering in memory
  return new Promise<string>((resolve, reject) => {
    // node-fetch@2 can return either Node.js Readable or Web Stream
    // Duck-type to handle both cases
    const body = response.body as any;
    const nodeStream: Readable = body.pipe
      ? body  // Already a Node.js Readable stream
      : Readable.fromWeb(body);  // Web Stream - convert it
    const writeStream = file.createWriteStream({
      metadata: {
        contentType,
        metadata: {
          'custom:lifecycleTag': null,
          'custom:variantType': 'canonical',
        },
      },
      resumable: true, // Enable resumable uploads for large Veo3 videos
    });
    
    let bytesUploaded = 0;
    
    nodeStream.on('data', (chunk) => {
      bytesUploaded += chunk.length;
    });
    
    nodeStream.on('error', (error) => {
      logger.error('Error reading video stream', { error, sourceUrl, destinationPath });
      reject(new Error(`Failed to read video stream: ${error.message}`));
    });
    
    writeStream.on('error', (error) => {
      logger.error('Error writing to object storage', { error, destinationPath });
      reject(new Error(`Failed to upload to object storage: ${error.message}`));
    });
    
    writeStream.on('finish', () => {
      logger.info('Video uploaded to object storage', { 
        destinationPath,
        bucketName,
        objectName,
        bytesUploaded,
      });
      resolve(`/objects/${destinationPath}`);
    });
    
    nodeStream.pipe(writeStream);
  });
}
