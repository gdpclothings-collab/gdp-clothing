# GDP Touch Studio

Unified garment editing controls for Custom Studio.

- Photo Bootleg, Memorial Tribute and Upload My Own Artwork use the shared `CustomStudioAdvancedEditor`.
- Seasonal keeps its production capture architecture and receives aligned direct-touch artwork gestures.
- Core touch language: drag, pinch, twist, contextual tools and safe-area feedback.
- Contextual photo, text, sticker, layer, crop, effects and production-safe controls share one interaction system.
- Step 3 personalization stays inside GDP Touch Studio: Canvas contains front/back, zoom, print guide, measurements and edit-status guidance; Design contains template, color finish and design intensity; Photos/Artwork contains upload, photo editing and fallback artwork transform controls; Lettering contains wording and typography controls; Memorial Details contains the printed name, dates, remembrance message and spelling confirmation; Layers contains object ordering and visibility controls.
- Duplicate white Step 3 editing sections and the separate Step 3 customization heading are removed from the active interface while existing state/data bindings remain intact for production and cart compatibility.
- Template/front-side guidance appears contextually inside the panel instead of as separate page messages.
- Continue validation opens the exact missing panel tab before scrolling to and highlighting the required control.
- Fallback no-layer artwork retains source selection, size, fit/crop, aspect-ratio/stretch and rotation controls inside Photos/Artwork, including undo checkpoints.
- Mobile hardening constrains the editor and workspace to the viewport and keeps horizontal scrolling inside tool strips.
- On phones, GDP Touch Studio uses a portrait-first sheet: primary and contextual tool tabs wrap into a three-column grid, the panel is capped to the phone width, and vertical scrolling stays inside the panel instead of forcing sideways navigation.
- Saved unfinished Custom Studio work is no longer silently restored on re-entry. Customers explicitly choose Resume previous design or Start fresh; choosing Start fresh clears only the unfinished Studio draft and leaves completed cart designs untouched.
- Print-area warnings stay outside the artwork HUD, while the safe-area boundary remains visible on the garment.
- Release validation covers build, type safety and existing Custom Studio regression suites before merge.