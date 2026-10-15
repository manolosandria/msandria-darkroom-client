# Photo delivery verification

Verified on 2026-10-15 against the local client and API on `feat/photo-list-detail`.

## Automated regressions

Vitest checks the rendered grid, card and shared photo image: every source candidate
uses the API URL and its actual width; no widths are invented for small, nonstandard
or single-rendition images. Re-rendering does not alter rendition URLs. Loading and
size hints are checked alongside the existing gallery and management behaviour.

## Browser layout checks

The Chromium-based in-app browser was resized to these CSS viewport sizes:

| Reference | CSS viewport | Result |
| --- | --- | --- |
| Midrange phone | 360 × 800 | One photo per row, no gallery overflow |
| S25 Ultra reference | 412 × 892 | One photo per row, no gallery overflow |
| Pro Max reference | 440 × 956 | One photo per row, no gallery overflow |
| Phone landscape | 892 × 412, 956 × 440 | Justified rows, no gallery overflow |
| 1080p monitor | 1920 × 1080 | Justified rows within the gallery container |
| QHD monitor | 2560 × 1440 | Gallery remains within its maximum width |
| 4K / 55-inch TV reference | 3840 × 2160 | Same bounded gallery layout as QHD |
| Reflow checks | 1280 × 720, 960 × 540 | Rows adapt without gallery overflow |

The 892 px landscape check exposed existing header overflow after the Google sign-in
button appears. The image grid itself stays within the viewport; the header fix is
tracked separately. Screen diagonal is not an image selection input: CSS dimensions
and pixel density determine the image pixel budget.

## Density and zoom budgets

The browser tool supports viewport resizing, not direct hardware DPR or browser zoom
emulation. These are synthetic pixel-budget checks, not physical phone, Safari or TV
browser certification. At each matching viewport, a temporary probe measured the
first gallery image's actual layout width, supplied native srcset candidates with
correct widths and tested `layout width × target DPR × zoom` through a `sizes` hint
adjusted for the browser's native DPR. Per-case diagnostic query parameters isolated
candidate selection from previously cached larger variants. Production URLs were
not changed. The probe and all temporary code were removed after verification.

| Reference | Target DPR | Required px at 100% | Selected at 100% / 150% / 200% |
| --- | --- | --- | --- |
| Midrange phone | 3 | 938 | 960 / 1280 / 1280 |
| S25 Ultra reference | 3.5 | 1277 | 1280 / 1280 / 1280 |
| Pro Max reference | 3 | 1178 | 1280 / 1280 / 1280 |
| 1080p | 1 | 444 | 640 / 960 / 960 |
| QHD | 1 | 463 | 640 / 960 / 960 |
| 4K TV | 1 | 463 | 640 / 960 / 960 |
| 4K at 2× desktop scaling | 2 | 888 | 960 / 1280 / 1280 |

All 21 cases selected an available candidate; sizes above the listing ceiling use
1280 px. Native auto-sizes also selected real 320 and 640 px variants during viewport
checks. The browser may retain a larger cached candidate instead of downloading a
smaller one. These results do not promise full native sharpness above the 1280 px
listing ceiling; larger detail renditions and the quality selector are separate work.

## HTTP cache checks

Cloudinary's real response had `Cache-Control: no-transform, max-age=2592000,
private, immutable`, an `ETag`, and `Timing-Allow-Origin: *`.

Resource Timing measured the actual rendered production URLs:

- Gallery → home: the larger home card fetched a new 960 px variant once
  (125307 encoded bytes, 125607 transferred bytes).
- Returning to the gallery: all six images had `transferSize: 0` and
  `deliveryType: cache`.
- Returning to the home page: the new rendition also had `transferSize: 0`,
  with 125307 encoded bytes served from cache.
- Opening a separate same-origin gallery tab: all six images again had zero
  transferred bytes and cache delivery.

Browser cache reuse is confirmed for this run, not guaranteed for every subsequent
visit: cache eviction, reload mode, changed URLs, formats and browser partitioning can
affect reuse. CDN caching is distinct from browser caching and does not itself avoid
sending bytes to a visitor. No service worker, extra CDN or cache-busting production
parameters were introduced. No billing savings percentage is claimed.

## Repeating the checks

1. Start the API and client with development configuration.
2. Open `/gallery` with browser cache enabled and inspect actual `currentSrc`, `srcset`
   and rendered widths at the viewport sizes above. Native descriptors must equal the
   widths returned by the API, including widths below the standard rendition sizes.
3. Test the target devices or use browser device emulation for real DPR and zoom;
   check both portrait and landscape. Expect the 1280 px listing ceiling.
4. Navigate gallery → home → gallery → home and open another same-origin tab.
   With Resource Timing (Cloudinary exposes timing) or the Network panel, distinguish
   zero-transfer cache delivery from a new, larger rendition being downloaded once.
5. Confirm real Safari/iOS and the intended TV browser before claiming device support.
