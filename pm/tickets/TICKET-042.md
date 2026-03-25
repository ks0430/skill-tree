# TICKET-042: Edge weight visualisation

**Status:** done
**Roadmap item:** ITEM-042
**Created:** 2026-03-25T04:30:12Z
**Completed:** 2026-03-25
**Commit:** 02be716

## Brief
line thickness + opacity by weight

## Acceptance Criteria
- [ ] Implementation matches the description above
- [ ] Code is clean and consistent with the existing codebase
- [ ] No regressions introduced

## Git Diff Summary

- `src/components/canvas/WeightGraphView.tsx` — added `edgeBaseOpacity()` helper (weight→0.25–0.85); applied to SVG `strokeOpacity` baseline so low-weight edges are faint and high-weight edges vivid. Dimmed state reduced from 0.08 to 0.06 for cleaner hover contrast.
- `src/components/canvas/EdgeRenderer.tsx` — added `edgeBaseOpacity3D()` (weight→0.15–0.65) and `edgeLineWidth3D()` (weight→1–4px) helpers; applied base opacity and linewidth to Three.js `LineBasicMaterial` each frame so 3D edges also reflect weight visually.

## Summary

Added edge weight visualisation across both the 2D SVG force graph (`WeightGraphView`) and the 3D Three.js canvas (`EdgeRenderer`). Edges now vary in both line thickness (already done for 2D, extended to 3D) and opacity (new for both views): high-weight edges are thicker and more opaque, low-weight edges are thinner and more transparent. The weight range 0–1 maps to opacity 0.25–0.85 in 2D and 0.15–0.65 in 3D, with highlighted/hovered edges still boosting to full opacity. Dimmed (non-hovered) edges use a tighter fade to preserve contrast.
