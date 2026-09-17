# Hero video encode

The hero art (`asset/Hero.mp4`, 3840×2160 / 30fps / 24.8 Mbps / 93 MB) is a
mastering file. It is **not committed** and **not served**. The three tiers in
`asset/hero/` are encoded from it and are what ships.

| File | Codec | Size | Bitrate | Serves |
|---|---|---|---|---|
| `hero-1440.av1.mp4` | AV1 (SVT) | 24 MB | 6.8 Mbps | desktop/laptop where AV1 decodes |
| `hero-1440.h264.mp4` | H.264 high | 33 MB | 9.4 Mbps | desktop fallback |
| `hero-720.h264.mp4` | H.264 main | 8 MB | 2.5 Mbps | phones, data saver |
| `hero-poster.jpg` | JPEG q6 | 136 KB | — | poster / reduced motion |

One tier is fetched per visit — the picker in `duckpeon_latest.html` sets
`video.src` directly rather than using a `<source media>` ladder, because that
is resolved once at parse time and would strand a desktop tab that opened narrow
on the 720p copy.

## Why 1440p and not 4K

Measured, not assumed:

- Lossless 1440p scores **VMAF 97.7** against the 4K source — downscaling itself
  costs only 2.3 points, because much of the "4K detail" is upscale ringing.
  Inspection of the source at 4× zoom shows soft, haloed dither: the master was
  itself upscaled.
- Native 4K at CRF 20 scores 94.1 at 13.3 Mbps — **0.6 points** better than
  1440p AV1 for **1.4× the bytes**.
- High-frequency detail retained: 1440p keeps 84% of 4K's, 1080p 76%.
- The hero renders behind a gradient scrim at `object-fit:cover`, overlaid with
  type. 4K is not resolvable there.

Shipping AV1 scores **VMAF 91.2** over the full 30s at 26% of the source size.

## Scaler

Lanczos. Measured ceilings at 1440p: lanczos 97.71, bicubic 97.66, spline 97.30,
**neighbor 94.99**. Nearest-neighbour is worst despite being the usual pixel-art
choice — 3840→2560 is not an integer ratio, so it aliases the dither instead of
preserving it.

## Commands

```sh
# AV1 1440p — primary
ffmpeg -i asset/Hero.mp4 -an -vf "scale=2560:1440:flags=lanczos" \
  -c:v libsvtav1 -preset 5 -crf 26 -g 120 \
  -svtav1-params "tune=0:film-grain=0" \
  -pix_fmt yuv420p -movflags +faststart asset/hero/hero-1440.av1.mp4

# H.264 1440p — fallback
ffmpeg -i asset/Hero.mp4 -an -vf "scale=2560:1440:flags=lanczos" \
  -c:v libx264 -preset slow -crf 21 -profile:v high -level 5.1 -g 120 \
  -pix_fmt yuv420p -movflags +faststart asset/hero/hero-1440.h264.mp4

# H.264 720p — phones
ffmpeg -i asset/Hero.mp4 -an -vf "scale=1280:720:flags=lanczos" \
  -c:v libx264 -preset slow -crf 22 -profile:v main -level 4.0 -g 120 \
  -pix_fmt yuv420p -movflags +faststart asset/hero/hero-720.h264.mp4

# poster (frame 0, must match or the blur-in jumps)
ffmpeg -i asset/Hero.mp4 -frames:v 1 -vf "scale=1280:720:flags=lanczos" \
  -q:v 6 asset/hero/hero-poster.jpg
```

Audio is stripped (`-an`) throughout: the hero is a muted background loop, and
the track was dead weight that also risks tripping autoplay policies.

## Verifying a re-encode

```sh
ffmpeg -i asset/hero/hero-1440.av1.mp4 -i asset/Hero.mp4 \
  -lavfi "[0:v]scale=3840:2160:flags=lanczos[d];[d][1:v]libvmaf" -f null -
```

Expect ~91. Note the score prints at ffmpeg's `info` log level, not `error`.
VMAF is tuned for natural video and under-weights dither, so also eyeball a 4×
crop of the ducks — the crosshatch on their bodies is the thing that breaks
first if the bitrate is cut too far.
