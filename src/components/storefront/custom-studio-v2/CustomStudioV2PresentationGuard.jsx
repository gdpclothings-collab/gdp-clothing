import React, { useEffect, useRef, useState } from 'react';
import CustomStudioV2 from '@/pages/CustomStudioV2';
import './customStudioV2MobileRepair.css';
import './customStudioV2ApprovalRefinement.css';
import './photoBootlegLayerOrder.css';
import './customStudioV2PresentationCleanup.css';
import './customStudioV2Premium.css';
import './customStudioV2DesignGallery.css';

/**
 * Presentation-only boundary for the rebuilt Custom Studio.
 *
 * Keep mobile containment/rendering fixes outside editor state, production
 * composition, pricing, uploads and cart wiring so a visual repair cannot
 * silently change customer design data or fulfillment behavior.
 */
export default function CustomStudioV2PresentationGuard() {
  const rootRef = useRef(null);
  const [reviewPreviewReady, setReviewPreviewReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof MutationObserver === 'undefined') return undefined;

    let animationFrame = 0;
    const reviewPreviewSnapshots = new Map();
    let snapshotContext = '';
    let renderedReviewSignature = '';

    const neutralizePrintingTerms = (value) => String(value || '')
      .replace(/DTF file guidelines/gi, 'File guidelines')
      .replace(/DTF printing disclaimer/gi, 'Printing disclaimer')
      .replace(/DTF print care/gi, 'Print care')
      .replace(/DTF print guide/gi, 'print guide')
      .replace(/DTF production/gi, 'production')
      .replace(/DTF printing/gi, 'printing')
      .replace(/DTF prints/gi, 'prints')
      .replace(/DTF print/gi, 'print')
      .replace(/\bDTF\b/gi, 'printing');

    const snapshotLiveGarmentPreviews = () => {
      // A new garment/colour/size/path must never inherit a previous design's preview.
      const context = root.querySelector('[data-gdp-premium-studio="true"]')?.getAttribute('data-gdp-preview-context') || '';
      if (context !== snapshotContext) {
        reviewPreviewSnapshots.clear();
        renderedReviewSignature = '';
        snapshotContext = context;
      }
      root.querySelectorAll('[data-gdp-print-guide="true"]').forEach((guide) => {
        if (guide.closest('[data-gdp-final-review-preview="true"]')) return;
        const section = guide.closest('section');
        if (!section) return;

        // Seasonal Design Lab labels its canvas "Fabric workspace" instead of "Live garment preview".
        // Collect both without ever changing the canonical artwork/print-guide geometry.
        const heading = Array.from(section.querySelectorAll('p')).find((node) => /live garment preview|fabric workspace/i.test(node.textContent || ''));
        if (!heading) return;
        // The presentation pass rewrites the guide's aria-label to "Print area".
        // Never infer "front" when its original side label has been removed:
        // that used to overwrite the front snapshot with the back garment.
        const sideMatch = (guide.getAttribute('data-gdp-print-side') || '').match(/^(front|back)$/i)
          || (guide.getAttribute('aria-label') || '').match(/\b(front|back)\b/i)
          || (section.querySelector('img[alt$=" preview"]')?.getAttribute('alt') || '').match(/\b(front|back) preview$/i)
          || (heading.textContent || '').match(/\b(front|back)\b/i);
        if (!sideMatch) return;
        const side = sideMatch[1].toLowerCase();
        const isSeasonal = section.matches('[data-gdp-seasonal-canvas-stable="true"]');
        if (isSeasonal && section.getAttribute('data-gdp-seasonal-library-ready') !== 'true') return;
        // Unprinted sides are rendered from the correct blank garment image
        // at review time. Do not snapshot the editor's empty/loading text.
        if (isSeasonal && !guide.querySelector('button[data-seasonal-v2-layer]')) {
          reviewPreviewSnapshots.delete(side);
          return;
        }
        const clone = section.cloneNode(true);

        // Seasonal art is rendered inside moveable buttons. Convert each layer
        // to an inert positioned element BEFORE stripping editing controls,
        // otherwise removing buttons also removes the customer's actual design.
        clone.querySelectorAll('button[data-seasonal-v2-layer]').forEach((layer) => {
          const staticLayer = clone.ownerDocument.createElement('div');
          staticLayer.setAttribute('data-gdp-seasonal-review-artwork', 'true');
          staticLayer.setAttribute('role', 'img');
          const artworkLabel = (layer.getAttribute('aria-label') || 'Approved seasonal artwork').replace(/, selected$/i, '');
          staticLayer.setAttribute('aria-label', artworkLabel);
          staticLayer.className = String(layer.className || '')
            .replace(/\bring[^\s]*/g, '')
            .replace(/\bcursor-move\b/g, 'cursor-default')
            .replace(/\btouch-none\b/g, '')
            .trim();
          staticLayer.style.cssText = layer.style.cssText;
          while (layer.firstChild) staticLayer.appendChild(layer.firstChild);
          layer.replaceWith(staticLayer);
        });
        // Protected Photo Bootleg and Memorial previews include a layer
        // selector and an "Editing Photo/Template/Text/Sticker" status panel.
        // They guide editing in Step 3 but must never be copied into the
        // read-only Step 4 approval mockup. Remove these only from the clone;
        // actual canvas artwork and saved transforms stay untouched.
        clone.querySelectorAll([
          '[data-gdp-bootleg-active-layer]',
          '[data-gdp-memorial-active-layer]',
          '[data-gdp-bootleg-active-status]',
          '[data-gdp-memorial-active-status]',
          '[data-gdp-bootleg-confirm-action]',
          '[data-gdp-memorial-confirm-action]',
          '[data-gdp-bootleg-upload-status]',
        ].join(',')).forEach((node) => node.remove());
        clone.querySelectorAll('[data-gdp-seasonal-empty-overlay="true"],[data-gdp-seasonal-library-loading="true"]').forEach((node) => node.remove());
        clone.querySelectorAll('button,input,select,textarea').forEach((node) => node.remove());
        // Approved previews show only garment + artwork, never Step 3 print
        // boundaries or measurement labels. Removing data-gdp-print-size also
        // removes its CSS-generated ::before badge without touching geometry.
        clone.querySelectorAll('[data-gdp-print-size]').forEach((node) => {
          node.removeAttribute('data-gdp-print-size');
        });
        clone.querySelectorAll('[data-gdp-print-guide="true"]').forEach((node) => {
          // Keep the guide's exact border-box size/position (and therefore
          // approved artwork coordinates) but remove ALL visible editor chrome.
          // The original dashed guide also has a subtle outline box shadow.
          node.style.borderColor = 'transparent';
          node.style.boxShadow = 'none';
          node.style.outline = 'none';
          node.style.background = 'transparent';
          const badge = node.querySelector(':scope > span');
          if (badge) badge.remove();
        });
        clone.querySelectorAll('[data-gdp-upload-artwork-layer="true"]').forEach((node) => {
          node.className = String(node.className || '')
            .replace(/\bring[^\s]*/g, '')
            .replace(/\bcursor-grab\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        });

        // Photo Bootleg and Memorial Tribute artwork is already in div/img/svg layers.
        // Keep every transform and visual element, but remove active editing outlines
        // and drag cursors from the customer-facing, read-only approval preview.
        clone.querySelectorAll([
          '[data-gdp-bootleg-template-layer]',
          '[data-gdp-memorial-template-layer]',
          '[data-gdp-bootleg-free-photo-layer]',
          '[data-gdp-memorial-free-photo-layer]',
          '[data-gdp-bootleg-text-layer]',
          '[data-gdp-memorial-text-layer]',
          '[data-gdp-sticker-layer-id]',
        ].join(',')).forEach((node) => {
          node.className = String(node.className || '')
            .replace(/\b(?:active:)?ring[^\s]*/g, '')
            .replace(/\bcursor-(?:grab|grabbing|move)\b/g, 'cursor-default')
            .replace(/\s+/g, ' ')
            .trim();
        });
        // Selection geometry is an editing aid, not part of the approved design.
        clone.querySelectorAll('[data-gdp-bootleg-text-bounds="true"]').forEach((node) => node.remove());
        clone.querySelectorAll('p').forEach((node) => {
          if (/one finger moves|choose a layer first|tap a layer in the list/i.test(node.textContent || '')) node.remove();
        });

        const clonedHeading = Array.from(clone.querySelectorAll('p')).find((node) => /live garment preview|fabric workspace/i.test(node.textContent || ''));
        if (clonedHeading) clonedHeading.textContent = `Final garment preview · ${side}`;
        // A workspace can contain BOTH the touch-gesture hint and the dashed
        // fabric box description. Remove every editor-only guidance paragraph,
        // not just the first matching paragraph.
        clone.querySelectorAll('p').forEach((node) => {
          if (/drag with one finger|drag to move|dashed fabric box|dashed boundary|normalized geometry/i.test(node.textContent || '')) {
            node.remove();
          }
        });

        clone.setAttribute('data-gdp-final-review-preview-card', side);
        clone.className = 'overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4';
        reviewPreviewSnapshots.set(side, clone.outerHTML);
      });
    };

    const syncFinalReviewPreview = () => {
      const finalHeading = Array.from(root.querySelectorAll('h1')).find((node) => /^final review$/i.test((node.textContent || '').trim()));
      if (!finalHeading) {
        renderedReviewSignature = '';
        setReviewPreviewReady(false);
        return;
      }
      const reviewRoot = finalHeading.parentElement;
      if (!reviewRoot) return;
      const isSeasonal = reviewRoot.getAttribute('data-gdp-review-design-path') === 'seasonal';
      if (!isSeasonal && !reviewPreviewSnapshots.size) return;
      const printedSides = (reviewRoot.getAttribute('data-gdp-review-print-sides') || '')
        .split(',').filter((side) => side === 'front' || side === 'back');
      const signature = JSON.stringify({
        context: snapshotContext,
        path: reviewRoot.getAttribute('data-gdp-review-design-path'),
        printedSides,
        front: reviewPreviewSnapshots.get('front') || '',
        back: reviewPreviewSnapshots.get('back') || '',
      });
      let container = reviewRoot.querySelector('[data-gdp-final-review-preview="true"]');
      if (!container || renderedReviewSignature !== signature) {
        const nextContainer = document.createElement('div');
        nextContainer.setAttribute('data-gdp-final-review-preview', 'true');
        nextContainer.className = 'mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 p-3 shadow-inner sm:p-4';
        const title = document.createElement('div');
        title.className = 'mb-3 flex flex-wrap items-end justify-between gap-2 px-1';
        title.innerHTML = '<div><p class="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Approved preview</p><h2 class="mt-1 text-lg font-black text-slate-950">Your garment with the approved artwork</h2></div><span data-gdp-review-status-label="true" class="rounded-full bg-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-slate-700">Preparing preview</span>';
        nextContainer.appendChild(title);

        const cards = document.createElement('div');
        cards.className = isSeasonal || reviewPreviewSnapshots.size > 1
          ? 'grid gap-3 md:grid-cols-2' : 'mx-auto max-w-2xl';
        ['front', 'back'].forEach((side) => {
          const html = reviewPreviewSnapshots.get(side);
          if (!isSeasonal) {
            if (html) cards.insertAdjacentHTML('beforeend', html);
            return;
          }
          if (printedSides.includes(side) && html) {
            cards.insertAdjacentHTML('beforeend', html);
            return;
          }
          // Keep the back of a front-only garment truly blank, without
          // capturing the editor placeholder or recycling the front/back image.
          const card = document.createElement('section');
          card.setAttribute('data-gdp-final-review-preview-card', side);
          card.className = 'overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4';
          const heading = document.createElement('p');
          heading.className = 'mb-3 text-[10px] font-black uppercase tracking-[.14em] text-slate-400';
          heading.textContent = `Final garment preview · ${side}`;
          card.appendChild(heading);
          const frame = document.createElement('div');
          frame.className = 'relative mx-auto aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-2xl bg-slate-100 p-3';
          const imgUrl = reviewRoot.getAttribute(`data-gdp-review-${side}-garment`);
          if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.alt = `Blank ${side} of selected garment`;
            img.className = 'h-full w-full object-contain';
            frame.appendChild(img);
          }
          card.appendChild(frame);
          if (printedSides.includes(side)) {
            const notice = document.createElement('p');
            notice.setAttribute('role', 'status');
            notice.className = 'mt-3 text-xs font-semibold text-amber-800';
            notice.textContent = `The ${side} artwork preview is not ready. Return to Step 3 and open that side before continuing.`;
            card.appendChild(notice);
          }
          cards.appendChild(card);
        });
        nextContainer.appendChild(cards);
        const reviewGrid = Array.from(reviewRoot.children).find((node) => node.classList?.contains('mt-6') && node.classList?.contains('grid'));
        if (!reviewGrid) return;
        if (container) container.replaceWith(nextContainer);
        else reviewRoot.insertBefore(nextContainer, reviewGrid);
        container = nextContainer;
        renderedReviewSignature = signature;
      }

      if (!isSeasonal) return;
      const missingPrintedSide = printedSides.some((side) => !reviewPreviewSnapshots.has(side));
      const images = Array.from(container.querySelectorAll('img'));
      const imagesLoaded = images.length >= 2 && images.every((img) => img.complete && img.naturalWidth > 0);
      const failedImage = images.some((img) => img.complete && img.naturalWidth === 0);
      const ready = printedSides.length > 0 && !missingPrintedSide && imagesLoaded;
      const status = ready ? 'ready' : failedImage ? 'error' : 'pending';
      if (container.getAttribute('data-gdp-review-status') !== status) {
        container.setAttribute('data-gdp-review-status', status);
      }
      const label = container.querySelector('[data-gdp-review-status-label="true"]');
      if (label) {
        const text = ready ? 'Ready for final check' : failedImage ? 'Preview failed to load' : 'Preparing preview';
        if (label.textContent !== text) label.textContent = text;
        const classes = ready
          ? 'rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-emerald-800'
          : 'rounded-full bg-amber-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-amber-800';
        if (label.className !== classes) label.className = classes;
      }
      setReviewPreviewReady(ready);
    };

    const syncGarmentSizeSemantics = () => {
      const configurator = root.querySelector('[data-gdp-selected-garment-configurator="true"]');
      if (!configurator) return;

      const sizeLabel = Array.from(configurator.querySelectorAll('div')).find((node) =>
        node.children.length === 0 && /^size$/i.test((node.textContent || '').trim())
      );
      const sizePanel = sizeLabel?.parentElement?.parentElement;
      if (!sizePanel) return;

      const sizeButtons = Array.from(sizePanel.querySelectorAll('button'));
      if (!sizeButtons.length) return;

      const sizeGroup = sizeButtons[0]?.parentElement;
      if (sizeGroup?.getAttribute('role') !== 'group') sizeGroup?.setAttribute('role', 'group');
      if (sizeGroup?.getAttribute('aria-label') !== 'Garment size') sizeGroup?.setAttribute('aria-label', 'Garment size');
      if (sizeGroup?.getAttribute('data-gdp-garment-size-group') !== 'true') sizeGroup?.setAttribute('data-gdp-garment-size-group', 'true');

      sizeButtons.forEach((button) => {
        const label = String(button.textContent || '').trim();
        if (!label) return;
        const available = !button.disabled;
        const selected = available && button.classList.contains('border-slate-900') && button.classList.contains('bg-slate-900');
        const ariaLabel = available ? `Select size ${label}` : `Size ${label}, unavailable`;

        if (button.getAttribute('data-gdp-garment-size') !== 'true') button.setAttribute('data-gdp-garment-size', 'true');
        const availability = available ? 'true' : 'false';
        if (button.getAttribute('data-gdp-size-available') !== availability) button.setAttribute('data-gdp-size-available', availability);
        const pressed = selected ? 'true' : 'false';
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
        if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
      });
    };

    const syncPresentationLabels = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        snapshotLiveGarmentPreviews();
        syncGarmentSizeSemantics();

        root.querySelectorAll('[data-gdp-print-guide="true"]').forEach((guide) => {
          // These labels belong to Step 3 only. The presentation observer
          // must not recreate the measurement badge inside approved copies.
          if (guide.closest('[data-gdp-final-review-preview="true"]')) return;
          const source = guide.getAttribute('aria-label') || guide.textContent || '';
          const match = source.match(/(\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*in)/i);
          if (!match) return;

          const dimensions = match[1].replace(/\s*x\s*/i, ' × ').replace(/\s*×\s*/g, ' × ');
          const frame = guide.parentElement;
          const printSizeLabel = `Print size · ${dimensions}`;
          if (frame?.getAttribute('data-gdp-print-size') !== printSizeLabel) {
            frame?.setAttribute('data-gdp-print-size', printSizeLabel);
          }

          const neutralAriaLabel = `Print area · ${dimensions}`;
          if (guide.getAttribute('aria-label') !== neutralAriaLabel) {
            guide.setAttribute('aria-label', neutralAriaLabel);
          }
        });

        const printingTypeButton = root.querySelector('[data-gdp-garment-info="true"] > div:first-child > button');
        if (printingTypeButton?.getAttribute('aria-label') !== 'Printing type') {
          printingTypeButton?.setAttribute('aria-label', 'Printing type');
        }

        const browseDescription = root.querySelector('[data-gdp-garment-mode="browse"] > div:first-child > p:last-child');
        const neutralBrowseDescription = 'Choose a garment first. After selection, the gallery collapses so you can focus on colour, size, quantity and printing details.';
        if (browseDescription?.getAttribute('aria-label') !== neutralBrowseDescription) {
          browseDescription?.setAttribute('aria-label', neutralBrowseDescription);
        }

        root.querySelectorAll('[data-gdp-garment-info="true"] [role="dialog"]').forEach((dialog) => {
          const label = dialog.getAttribute('aria-label') || '';
          if (/what is dtf printing/i.test(label)) return;

          const neutralLabel = neutralizePrintingTerms(label);
          if (neutralLabel !== label) dialog.setAttribute('aria-label', neutralLabel);

          const textNodeFilter = window.NodeFilter?.SHOW_TEXT ?? 4;
          const walker = document.createTreeWalker(dialog, textNodeFilter);
          const textNodes = [];
          while (walker.nextNode()) textNodes.push(walker.currentNode);
          textNodes.forEach((node) => {
            const nextValue = neutralizePrintingTerms(node.nodeValue);
            if (nextValue !== node.nodeValue) node.nodeValue = nextValue;
          });
        });

        syncFinalReviewPreview();
      });
    };

    root.addEventListener('load', syncPresentationLabels, true);
    root.addEventListener('error', syncPresentationLabels, true);
    syncPresentationLabels();
    const observer = new MutationObserver(syncPresentationLabels);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'class', 'disabled', 'style'],
      characterData: true,
    });

    return () => {
      observer.disconnect();
      root.removeEventListener('load', syncPresentationLabels, true);
      root.removeEventListener('error', syncPresentationLabels, true);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div ref={rootRef} data-gdp-studio-v2-guard="true" className="min-w-0 max-w-full overflow-x-clip">
      <CustomStudioV2 reviewPreviewReady={reviewPreviewReady} />
    </div>
  );
}