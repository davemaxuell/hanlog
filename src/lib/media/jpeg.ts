// APP1 holds EXIF (camera, time, GPS) and XMP; APP3–APP13, APP15 and comments hold other private
// notes. APP0 (JFIF), APP2 (colour profile) and APP14 (Adobe colour transform) stay so colours decode correctly.
const STRIPPED = new Set([0xe1, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xeb, 0xec, 0xed, 0xef, 0xfe]);
const isFrameHeader = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** Reads a JPEG's size and returns a copy without metadata segments, or null when the file is not a complete JPEG. */
export function inspectJpeg(input: Uint8Array): { bytes: Uint8Array; width: number; height: number } | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;
  const keep: Uint8Array[] = [input.subarray(0, 2)];
  let offset = 2; let width = 0; let height = 0;
  while (offset + 4 <= input.length) {
    if (input[offset] !== 0xff) return null;
    const marker = input[offset + 1];
    if (marker === 0xff) { offset += 1; continue; }
    if (marker < 0xc0 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) return null;
    const length = (input[offset + 2] << 8) | input[offset + 3];
    const end = offset + 2 + length;
    if (length < 2 || end > input.length) return null;
    if (marker === 0xda) {
      const rest = input.subarray(offset);
      if (!width || !height || rest.length < 4 || rest[rest.length - 2] !== 0xff || rest[rest.length - 1] !== 0xd9) return null;
      keep.push(rest);
      const bytes = new Uint8Array(keep.reduce((sum, part) => sum + part.length, 0));
      let at = 0;
      for (const part of keep) { bytes.set(part, at); at += part.length; }
      return { bytes, width, height };
    }
    if (isFrameHeader(marker)) {
      if (length < 8) return null;
      height = (input[offset + 5] << 8) | input[offset + 6];
      width = (input[offset + 7] << 8) | input[offset + 8];
    }
    if (!STRIPPED.has(marker)) keep.push(input.subarray(offset, end));
    offset = end;
  }
  return null;
}
