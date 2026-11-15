# HanLog audience QR

`hanlog-qr.svg` contains exactly this public destination, including the trailing slash:

```text
https://hanlog-nine.vercel.app/
```

Generated locally on 2026-11-16 from the HanLog repository root with the pinned `qrcode@1.5.4` CLI:

```powershell
npm exec --yes --package=qrcode@1.5.4 -- qrcode --type svg --error M --width 144 --qzone 4 --lightcolor FFFFFFFF --darkcolor 000000FF --output public/demo/hanlog-qr.svg 'https://hanlog-nine.vercel.app/'
```

The generator produces a black-on-white SVG, 144 × 144 pixels, error correction M, with an uninterrupted four-module white quiet zone. The SVG has a 37 × 37 viewBox: 29 × 29 data modules plus four quiet modules on every side. No logo, tracking parameter, account identifier, or external QR service is involved. The generator is a one-time development tool; no runtime or production dependency was added.

The generated XML declaration and external DTD declaration were removed with this command; SVG paths and dimensions are unchanged:

```powershell
$qrAssetPath = (Resolve-Path 'public/demo/hanlog-qr.svg').Path
$qrAssetText = [System.IO.File]::ReadAllText($qrAssetPath)
$qrAssetText = [System.Text.RegularExpressions.Regex]::Replace($qrAssetText, '<\?xml[^>]*\?>|<!DOCTYPE[^>]*>', '')
[System.IO.File]::WriteAllText($qrAssetPath, $qrAssetText, [System.Text.UTF8Encoding]::new($false))
```

Verification: generation completed successfully, the exact CLI payload and SVG dimensions/colors/quiet zone were inspected, and the UI test checks the accessible image and visible website link. No independent QR decoder was installed in the workspace, so an independent scan was not run. No decoder package was added.
