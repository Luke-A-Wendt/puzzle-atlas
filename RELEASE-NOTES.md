# Portable release validation

This full-project archive contains the latest constrained-solver behavior, including color holds, progressive manual searches, ring visibility controls, and the single Select held tool.

Portability fixes:
- Script, style, image, and puzzle page URLs carry a release identifier.
- The solver worker is pinned to its core bundle and data release.
- A mismatched cached model/cache is fetched once with cache reload; a continued mismatch is rejected.
- Direct file opening and incomplete publishing produce actionable diagnostics.
- The complete website has a SHA-256 release manifest; GitHub deployment checks it before publication.

Validation uses real production puzzle engines, solver bundles, and model/cache data with WebCrypto enabled. It covers all 34 puzzles, GitHub subdirectory mounting, all model and cache fingerprints, all 34 auto-solve replays, a 19-move Homer scramble, a constrained Homer swap, stale-cache recovery, and rejection of mismatched data. UI event tests cover the hold tool, pair selection, ring controls, and Auto Solve lifecycle. Browser visual testing was unavailable in the build environment; these are automated code, interaction, and replay checks.

External citations in guides are optional links, not runtime dependencies. The README screenshot is included locally. No live repository or website was modified to produce this archive.
