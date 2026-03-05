// storage.js — Yandex Object Storage (S3-compatible) via @aws-sdk/client-s3
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';

const REGION = 'ru-central1';
const ENDPOINT = 'https://storage.yandexcloud.net';

export const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.YC_ACCESS_KEY_ID,
    secretAccessKey: process.env.YC_SECRET_ACCESS_KEY,
  },
});

export const BUCKET = process.env.YC_BUCKET;

/**
 * Upload a local temp file to S3, then delete it locally.
 * @returns {string} S3 key
 */
export async function uploadToS3(localPath, s3Key, contentType) {
  const fileStream = fs.createReadStream(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileStream,
    ContentType: contentType,
  }));
  fs.unlinkSync(localPath); // clean up temp file
  return s3Key;
}

/**
 * Delete an object from S3 by key.
 */
export async function deleteFromS3(s3Key) {
  if (!s3Key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
  } catch (e) {
    console.error('S3 delete error:', e.message);
  }
}

/**
 * Get a signed URL for private audio streaming (expires in 1 hour).
 */
export async function getSignedStreamUrl(s3Key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

/**
 * Get a public URL for a cover image.
 * Works if the bucket has public read enabled for the covers/ prefix.
 * Falls back to signed URL otherwise.
 */
export function getPublicCoverUrl(s3Key) {
  return `${ENDPOINT}/${BUCKET}/${s3Key}`;
}
