const STYLE_ID = 'gdp-custom-studio-v2-selection-border-fix';
const PROTECTED_LAYER_GUARD_FLAG = '__gdpProtectedTemplateLayerStateGuard';

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-gdp-upload-artwork-layer="true"],
    [data-seasonal-v2-layer],
    [data-gdp-bootleg-free-photo-layer="true"],
    [data-gdp-memorial-free-photo-layer="true"],
    [data-gdp-sticker-layer-id],
    [data-gdp-bootleg-template-layer="true"],
    [data-gdp-memorial-template-layer="true"],
    div:has(> img[alt="Customer photo layer"]) {
      --tw-ring-offset-shadow: 0 0 #0000 !important;
      --tw-ring-shadow: 0 0 #0000 !important;
      box-shadow: none !important;
      outline: none !important;
    }

    /* Keep customer photos complete at every scale/rotation. The Photo Zone
       and print guide are placement guides only and must not mask the image. */
    [data-gdp-print-guide="true"],
    [data-gdp-bootleg-free-photo-layer="true"],
    [data-gdp-memorial-free-photo-layer="true"],
    div:has(> img[alt="Customer photo layer"]) {
      overflow: visible !important;
    }

    img[alt="Customer photo layer"] {
      object-fit: contain !important;
      overflow: visible !important;
    }

    /* Keep the printable-area helper transparent so the selected garment
       remains visible beneath the dashed guide. */
    [data-gdp-print-guide="true"] {
      background-color: transparent !important;
    }

    /* Empty Photo Zone helpers previously added a dark grey tint. Keep the
       wording and dashed boundary, but remove the fill and use neutral text. */
    [data-gdp-print-guide="true"] [class*="bg-slate-900/10"] {
      background-color: transparent !important;
      border-color: rgb(148 163 184 / 0.7) !important;
      color: rgb(100 116 139) !important;
      text-shadow: 0 1px 2px rgb(255 255 255 / 0.85);
    }

    /* Adapt the empty Photo Zone helper to the garment below it. Difference
       blending keeps the helper dark on light garments and light on dark
       garments without adding a fill or hard-coding garment color names. */
    [data-gdp-print-guide="true"] [class*="bg-slate-900/10"] {
      color: rgb(255 255 255) !important;
      border-color: rgb(255 255 255 / 0.72) !important;
      mix-blend-mode: difference;
      text-shadow: none !important;
    }

    /* Bootleg/Memorial empty-template message: keep the guidance while
       removing the dark banner so the garment preview remains unobstructed. */
    div:has(> [data-gdp-print-guide="true"])
      > div[class*="bottom-4"][class*="bg-slate-950/80"] {
      bottom: 0.75rem !important;
      padding: 0.6rem 0.9rem !important;
      background-color: rgb(255 255 255 / 0.82) !important;
      border: 1px solid rgb(226 232 240 / 0.95) !important;
      color: rgb(71 85 105) !important;
      box-shadow: 0 2px 10px rgb(15 23 42 / 0.08) !important;
      backdrop-filter: blur(2px);
    }

    /* Make the mobile interaction helper beneath Bootleg/Memorial previews
       easier to scan without changing any editor state or gestures. */
    div:has(> div > [data-gdp-print-guide="true"]) > p[class*="text-slate-400"] {
      margin-top: 0.45rem !important;
      padding-inline: 0.5rem !important;
      color: rgb(100 116 139) !important;
      font-size: 0.6875rem !important;
      line-height: 1.15rem !important;
    }

    /* Keep the active-layer status obvious without letting the old cyan bar
       dominate the garment preview. Applies only to Bootleg/Memorial editor
       status elements that already expose dedicated data attributes. */
    [data-gdp-bootleg-active-status="true"],
    [data-gdp-memorial-active-status="true"] {
      margin-bottom: 0.6rem !important;
      padding: 0.5rem 0.75rem !important;
      border-color: rgb(226 232 240) !important;
      background-color: rgb(248 250 252 / 0.92) !important;
      color: rgb(51 65 85) !important;
      box-shadow: inset 3px 0 0 rgb(15 23 42 / 0.9);
      font-size: 0.72rem !important;
      line-height: 1rem !important;
    }

    /* Replace the stale "Choose a layer first" helper with guidance that
       matches the layer button currently marked aria-pressed=true. */
    section:has(> [data-gdp-bootleg-active-layer="true"]),
    section:has(> [data-gdp-memorial-active-layer="true"]) {
      --gdp-active-layer-help: 'Select a layer to edit it directly on the garment.';
    }

    section:has(> [data-gdp-bootleg-active-layer="true"] > button:nth-child(1)[aria-pressed="true"]),
    section:has(> [data-gdp-memorial-active-layer="true"] > button:nth-child(1)[aria-pressed="true"]) {
      --gdp-active-layer-help: 'Template selected. Drag, resize or rotate it on the print area.';
    }

    section:has(> [data-gdp-bootleg-active-layer="true"] > button:nth-child(2)[aria-pressed="true"]),
    section:has(> [data-gdp-memorial-active-layer="true"] > button:nth-child(2)[aria-pressed="true"]) {
      --gdp-active-layer-help: 'Photo selected. Drag, resize or rotate it directly on the garment.';
    }

    section:has(> [data-gdp-bootleg-active-layer="true"] > button:nth-child(3)[aria-pressed="true"]),
    section:has(> [data-gdp-memorial-active-layer="true"] > button:nth-child(3)[aria-pressed="true"]) {
      --gdp-active-layer-help: 'Text selected. Move, resize or rotate the active text layer.';
    }

    section:has(> [data-gdp-bootleg-active-layer="true"] > button:nth-child(4)[aria-pressed="true"]),
    section:has(> [data-gdp-memorial-active-layer="true"] > button:nth-child(4)[aria-pressed="true"]) {
      --gdp-active-layer-help: 'Sticker selected. Move, resize or rotate the active sticker.';
    }

    section:has(> [data-gdp-bootleg-active-layer="true"]) > div:first-child > p:last-child,
    section:has(> [data-gdp-memorial-active-layer="true"]) > div:first-child > p:last-child {
      font-size: 0 !important;
      line-height: 0 !important;
    }

    section:has(> [data-gdp-bootleg-active-layer="true"]) > div:first-child > p:last-child::after,
    section:has(> [data-gdp-memorial-active-layer="true"]) > div:first-child > p:last-child::after {
      content: var(--gdp-active-layer-help);
      display: block;
      font-size: 0.875rem;
      line-height: 1.25rem;
    }

    /* Uploaded photos can carry long camera UUID filenames. Keep those raw
       names out of the customer-facing status strip while Photo is active. */
    [data-gdp-bootleg-active-layer="true"]:has(> button:nth-child(2)[aria-pressed="true"])
      + [data-gdp-bootleg-active-status="true"],
    [data-gdp-memorial-active-layer="true"]:has(> button:nth-child(2)[aria-pressed="true"])
      + [data-gdp-memorial-active-status="true"] {
      font-size: 0 !important;
      line-height: 0 !important;
    }

    [data-gdp-bootleg-active-layer="true"]:has(> button:nth-child(2)[aria-pressed="true"])
      + [data-gdp-bootleg-active-status="true"]::after,
    [data-gdp-memorial-active-layer="true"]:has(> button:nth-child(2)[aria-pressed="true"])
      + [data-gdp-memorial-active-status="true"]::after {
      content: 'Editing Photo';
      display: block;
      font-size: 0.72rem;
      line-height: 1rem;
    }

    /* Protected-template state guard. Before a Bootleg/Memorial template is
       selected there is no valid editable layer, so do not present Photo as
       active, do not expose the Photo Zone, and do not show layer controls. */
    [data-gdp-protected-layer-awaiting-template="true"] > button {
      background-color: rgb(255 255 255) !important;
      color: rgb(100 116 139) !important;
      box-shadow: none !important;
    }

    [data-gdp-protected-layer-awaiting-template="true"] > button:not(:first-child) {
      cursor: not-allowed !important;
      opacity: 0.35 !important;
    }

    section:has(> [data-gdp-protected-layer-awaiting-template="true"]) {
      --gdp-active-layer-help: 'Choose a template first. Layer editing will unlock after a layout is selected.';
    }

    [data-gdp-protected-status-awaiting-template="true"] {
      font-size: 0 !important;
      line-height: 0 !important;
    }

    [data-gdp-protected-status-awaiting-template="true"]::after {
      content: 'Choose a template to begin';
      display: block;
      font-size: 0.72rem;
      line-height: 1rem;
    }

    [data-gdp-protected-preview-awaiting-template="true"] [data-gdp-bootleg-free-photo-canvas="true"],
    [data-gdp-protected-preview-awaiting-template="true"] [data-gdp-memorial-free-photo-zone="true"] {
      display: none !important;
    }

    [data-gdp-protected-preview-awaiting-template="true"] > div:last-child > p:last-child {
      font-size: 0 !important;
      line-height: 0 !important;
    }

    [data-gdp-protected-preview-awaiting-template="true"] > div:last-child > p:last-child::after {
      content: 'Choose a template first · then select the layer you want to edit';
      display: block;
      font-size: 0.6875rem;
      line-height: 1.15rem;
    }

    [data-gdp-protected-inspector-awaiting-template="true"] > :not(:first-child) {
      display: none !important;
    }

    [data-gdp-protected-inspector-awaiting-template="true"]::after {
      content: 'Choose a Bootleg or Memorial template first. Photo, text and sticker controls will unlock after the layout is selected.';
      display: block;
      margin-top: 0.75rem;
      border: 1px solid rgb(226 232 240);
      border-radius: 0.75rem;
      background: rgb(248 250 252);
      padding: 0.75rem;
      color: rgb(71 85 105);
      font-size: 0.75rem;
      font-weight: 700;
      line-height: 1.15rem;
    }
  `;
  document.head.appendChild(style);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window[PROTECTED_LAYER_GUARD_FLAG]) {
  window[PROTECTED_LAYER_GUARD_FLAG] = true;
  const guardedControls = new WeakMap();
  let scheduled = false;

  const setAttributeIfNeeded = (element, name, value) => {
    if (!element) return;
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };

  const removeAttributeIfPresent = (element, name) => {
    if (element?.hasAttribute(name)) element.removeAttribute(name);
  };

  const reconcileProtectedLayerControls = (controls) => {
    const buttons = Array.from(controls.querySelectorAll(':scope > button'));
    const templateButton = buttons[0];
    if (!templateButton) return;

    const scope = controls.hasAttribute('data-gdp-bootleg-active-layer') ? 'bootleg' : 'memorial';
    const previewSection = controls.closest('section');
    const editorRoot = previewSection?.parentElement || null;
    const inspectorSection = previewSection?.nextElementSibling?.tagName === 'SECTION'
      ? previewSection.nextElementSibling
      : null;
    const status = controls.nextElementSibling?.matches?.('[data-gdp-bootleg-active-status="true"], [data-gdp-memorial-active-status="true"]')
      ? controls.nextElementSibling
      : null;
    const hasTemplate = !templateButton.disabled;
    const previous = guardedControls.get(controls);
    const scopeChanged = Boolean(previous && previous.scope !== scope);
    const firstScan = !previous;

    if (!hasTemplate) {
      setAttributeIfNeeded(controls, 'data-gdp-protected-layer-awaiting-template', 'true');
      setAttributeIfNeeded(previewSection, 'data-gdp-protected-preview-awaiting-template', 'true');
      setAttributeIfNeeded(status, 'data-gdp-protected-status-awaiting-template', 'true');
      setAttributeIfNeeded(inspectorSection, 'data-gdp-protected-inspector-awaiting-template', 'true');

      buttons.forEach((button, index) => {
        if (button.getAttribute('aria-pressed') !== 'false') button.setAttribute('aria-pressed', 'false');
        if (index > 0 && !button.disabled) {
          button.disabled = true;
          button.setAttribute('data-gdp-protected-state-guard-disabled', 'true');
        }
      });

      guardedControls.set(controls, { scope, hasTemplate: false });
      return;
    }

    removeAttributeIfPresent(controls, 'data-gdp-protected-layer-awaiting-template');
    removeAttributeIfPresent(previewSection, 'data-gdp-protected-preview-awaiting-template');
    removeAttributeIfPresent(status, 'data-gdp-protected-status-awaiting-template');
    removeAttributeIfPresent(inspectorSection, 'data-gdp-protected-inspector-awaiting-template');

    buttons.forEach((button) => {
      if (button.hasAttribute('data-gdp-protected-state-guard-disabled')) {
        button.disabled = false;
        button.removeAttribute('data-gdp-protected-state-guard-disabled');
      }
    });

    const activeIndex = buttons.findIndex((button) => button.getAttribute('aria-pressed') === 'true');
    const hasPhoto = Boolean(editorRoot?.querySelector('[data-gdp-bootleg-photo-layer-list="true"]'));
    const templateBecameAvailable = previous?.hasTemplate === false;

    /* React keeps the protected editor mounted when paths change. Reset only
       the invalid default/stale Photo selection; after the customer explicitly
       opens Photo, Text or Sticker controls we preserve that choice. */
    const shouldSelectTemplate = scopeChanged
      || templateBecameAvailable && activeIndex < 0
      || firstScan && activeIndex === 1 && !hasPhoto;

    if (shouldSelectTemplate && templateButton.getAttribute('aria-pressed') !== 'true') {
      templateButton.click();
    }

    guardedControls.set(controls, { scope, hasTemplate: true });
  };

  const reconcileProtectedLayerState = () => {
    document
      .querySelectorAll('[data-gdp-bootleg-active-layer="true"], [data-gdp-memorial-active-layer="true"]')
      .forEach(reconcileProtectedLayerControls);
  };

  const scheduleReconcile = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      reconcileProtectedLayerState();
    });
  };

  reconcileProtectedLayerState();
  new MutationObserver(scheduleReconcile).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'disabled', 'data-gdp-bootleg-active-layer', 'data-gdp-memorial-active-layer'],
  });
}
