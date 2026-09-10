# GDP Touch Studio

Unified garment editing controls for Custom Studio.

- Photo Bootleg, Memorial Tribute and Upload My Own Artwork use the shared `CustomStudioAdvancedEditor`.
- Seasonal keeps its production capture architecture and receives aligned direct-touch artwork gestures.
- Core touch language: drag, pinch, twist, contextual tools and safe-area feedback.
- Contextual photo, text, sticker, layer, crop, effects and production-safe controls share one interaction system.
- Step 3 personalization now stays inside GDP Touch Studio: Design contains template and finish selection, Photos/Artwork contains upload and photo editing, Lettering contains wording and typography controls, Memorial Details contains the printed name, dates, remembrance message and spelling confirmation, and Layers contains object ordering and visibility controls.
- Duplicate white Step 3 editing sections are hidden while their existing state/data bindings remain intact for production and cart compatibility.
- Template/front-side guidance now appears inside the Design tab instead of as separate page messages.
- Mobile hardening constrains the editor and workspace to the viewport, keeps horizontal scrolling inside tool strips, and stacks transform controls on narrow screens.
- Print-area warnings stay outside the artwork HUD, while the safe-area boundary remains visible on the garment.
- Continue validation remains actionable: missing artwork style, color finish, photo upload, or Memorial details are scrolled into view and highlighted.
- Release validation covers build, type safety and the existing Custom Studio regression suites before merge.