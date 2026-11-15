import { BufferSource, Input, MP4, OGG, WAVE, WEBM } from 'mediabunny';
import { LIMITS, type MediaKind } from '../contracts';
import { ApiError } from '../errors';

export async function inspectPeerMedia(bytes: Uint8Array, kind: MediaKind): Promise<number> {
  const input = new Input({ source: new BufferSource(bytes), formats: [MP4, WEBM, OGG, WAVE] });
  try {
    const audio = await input.getAudioTracks();
    const video = await input.getVideoTracks();
    if (kind === 'audio' ? !audio.length || video.length > 0 : !video.length) throw new ApiError('media_invalid');
    // Scan actual track timing; browser WebM and fragmented MP4 often omit duration metadata.
    const durationMs = Math.round(await input.computeDuration(undefined, { skipLiveWait: true }) * 1000);
    // A recording stopped at 20s can contain an AAC/Opus tail of a few milliseconds.
    if (!Number.isSafeInteger(durationMs) || durationMs < LIMITS.recorder.minMs || durationMs > LIMITS.peerMedia.maxMs + 100) throw new ApiError('invalid_input');
    return Math.min(durationMs, LIMITS.peerMedia.maxMs);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('media_invalid');
  } finally { input.dispose(); }
}
