# Synthetic media fixtures

Generated locally with FFmpeg from `anullsrc=r=48000:cl=mono` (silence), and for video `color=c=black:s=32x32:r=10`. These files contain no personal audio or images and are committed so tests do not need FFmpeg installed.

- `audio.webm`, `long.webm`, `boundary.webm`, `over-boundary.webm`: 3, 21, 20, and 20.1 seconds respectively, `-c:a libopus -b:a 8k -live 1`. No container duration metadata. Packet-derived durations are 3.001, 21.001, 20.001, and 20.101 seconds.
- `audio.mp4`, `boundary.mp4`: 3 and 20 seconds, `-c:a aac -movflags frag_keyframe+empty_moov`. Fragmented MP4 with computed durations about 3.021 and 20.021 seconds.
- `video.mp4`: 3 seconds of black video and silence, `-c:v libx264 -preset ultrafast -c:a aac -movflags frag_keyframe+empty_moov`.
- `video-only.mp4`: 3 seconds of black video without an audio track, `-an -c:v libx264 -preset ultrafast -movflags frag_keyframe+empty_moov`. Rejected because a speaking response needs an audio track.
- `audio.ogg`: 3 seconds, `-c:a libopus -b:a 8k`.

Example generation: `ffmpeg -f lavfi -i anullsrc=r=48000:cl=mono -t 3 -c:a libopus -b:a 8k -live 1 audio.webm`.
