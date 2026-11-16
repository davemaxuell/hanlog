import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { inspectJpeg } from '@/lib/media/jpeg';

const photo = new Uint8Array(readFileSync('tests/fixtures/media/photo.jpg'));
const contains = (bytes: Uint8Array, text: string) => Buffer.from(bytes).includes(Buffer.from(text));

it('reads JPEG dimensions and strips camera and location metadata', () => {
  expect(contains(photo, 'HanLogTestCam')).toBe(true);
  const result = inspectJpeg(photo);
  expect(result).not.toBeNull();
  expect(result!.width).toBe(480);
  expect(result!.height).toBe(360);
  expect(contains(result!.bytes, 'HanLogTestCam')).toBe(false);
  expect(contains(result!.bytes, 'Exif')).toBe(false);
  // Still a complete JPEG: starts with SOI, ends with EOI, and keeps the image data.
  expect([...result!.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  expect([...result!.bytes.subarray(-2)]).toEqual([0xff, 0xd9]);
  expect(result!.bytes.length).toBeGreaterThan(photo.length / 3);
  expect(inspectJpeg(result!.bytes)).toMatchObject({ width: 480, height: 360 });
});

it('rejects files that are not complete JPEG images', () => {
  expect(inspectJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  expect(inspectJpeg(photo.subarray(0, 40))).toBeNull();
  expect(inspectJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  const broken = photo.slice(); broken[3] = 0x00; broken[4] = 0x01; broken[5] = 0x00;
  expect(inspectJpeg(broken)).toBeNull();
});
