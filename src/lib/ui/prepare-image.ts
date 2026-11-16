'use client';
import { LIMITS } from '@/lib/contracts';

export type PreparedImage = { blob: Blob; width: number; height: number; url: string };
export class ImagePrepError extends Error {
  constructor(readonly reason: 'not_image' | 'too_small' | 'undecodable') { super(reason); }
}

/**
 * Re-encodes a chosen photo as a JPEG no larger than the upload limit. Drawing to a canvas applies the
 * camera orientation and leaves EXIF (time, device, GPS location) behind.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new ImagePrepError('not_image');
  const source = await decode(file);
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, LIMITS.postImage.clientSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale); const height = Math.round(sourceHeight * scale);
  if (Math.min(width, height) < LIMITS.postImage.minSide) throw new ImagePrepError('too_small');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ImagePrepError('undecodable');
  context.fillStyle = '#FFFEF9';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();
  let quality = 0.86;
  let blob = await toJpeg(canvas, quality);
  while (blob.size > LIMITS.postImage.maxBytes * 0.9 && quality > 0.5) { quality -= 0.12; blob = await toJpeg(canvas, quality); }
  return { blob, width, height, url: URL.createObjectURL(blob) };
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Fall back to an image element. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch { throw new ImagePrepError('undecodable'); } finally { URL.revokeObjectURL(url); }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new ImagePrepError('undecodable')), 'image/jpeg', quality));
}
