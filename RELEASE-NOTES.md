# Release 70 — direct ring control and paired action feedback

Release fingerprint: `b847d94624b4531fcae9`  
Published source commit: `a2690887ff955c3c5ac1ee52eb9f5bce698c8b8b`

- Removed the ring map's visible axis-selector/turn panel, preserving direct ring selection and dragging.
- Retained the signed physical rotation controls below the 3D view, renamed Rotate followed by the corresponding arrow. The counterclockwise arrow remains positive viewed inward from the selected outward pole; the clockwise arrow remains negative.
- The active axis button and physical rotation-direction button light up together for each animated primitive. Repeated actions receive a fresh cue. The execution cue clears between stages and on completion or stop; reduced-motion settings use a steady highlight.
- Kept controls disabled during solver playback. Legal moves, ring geometry, journal conventions, solver implementations, and precomputed caches are unchanged.
- Updated shared and per-puzzle usage documentation; no repository README files changed.

## Complete portable project

This ZIP contains the complete static website in `dist/`, source, all 37 puzzle models and solver caches, tests, and the GitHub Pages workflow. No local build or editing is required before committing and pushing. Runtime website files match the published package byte for byte.

The existing GitHub README files and license are unchanged. Browser rendering and solver calculations run entirely on the local device. All runtime code, images, workers, and solver data are bundled. There are no development-site dependencies or external solver/API calls. Documentation contains optional reference links.

For use without internet, serve the extracted `dist/` directory over local HTTP; browser restrictions can prevent worker/data loading when opening HTML directly through `file://`. No online service is required by that local server.

Validation covers ring gestures with the control panel removed, physical rotation direction, synchronized execution feedback, disabled control states, constrained and automatic solver lifecycle, local assets and package integrity. Physical phone/browser rendering was not available in this environment.
