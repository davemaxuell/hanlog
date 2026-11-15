export function sniffMedia(bytes: Uint8Array): 'webm' | 'mp4' | 'ogg' | 'wav' | null {
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  if (bytes.length >= 8 && text(4, 4) === 'ftyp') return 'mp4';
  if (bytes.length >= 4 && text(0, 4) === 'OggS') return 'ogg';
  if (bytes.length >= 12 && text(0, 4) === 'RIFF' && text(8, 4) === 'WAVE') return 'wav';
  return null;
}
