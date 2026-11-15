# HanLog typography

The launch design follows `Daewoong_Thinking_Project_Topic2_Final.pptx`: **Paperlogy Bold** for display text and **Pretendard Regular / SemiBold** for body text and controls. Fonts are served locally through `next/font/local`; no third-party font request is needed. The Open Graph image uses the local Paperlogy TTF because `ImageResponse` does not support WOFF2.

| Files | Use | Original source | License |
| --- | --- | --- | --- |
| `Paperlogy-Bold.woff2`, `Paperlogy-Bold.ttf` | Heading weight 700; share image | [Freesentation / Paperlogy](https://github.com/Freesentation/paperlogy) | `Paperlogy-LICENSE.txt`, SIL OFL 1.1 |
| `Pretendard-Regular.woff2`, `Pretendard-SemiBold.woff2` | Body weight 400 and controls weight 600 | [orioncactus / Pretendard](https://github.com/orioncactus/pretendard) | `Pretendard-LICENSE.txt`, SIL OFL 1.1 |

The original Libre Baskerville file and `OFL.txt` remain from the earlier prototype and are no longer referenced by the app or its share image. Its source was [Libre Baskerville](https://github.com/impallari/Libre-Baskerville/tree/d20160cfa0ac4c532327f85b3ca4054acf92ed38), `fonts/ttf/LibreBaskerville-Regular.ttf`.

Keep each license with the corresponding font when redistributing these assets. The shared CSS tokens and `docs/design/open-window/tokens.json` record the application typography and palette.
