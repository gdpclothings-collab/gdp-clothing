import React, { useEffect, useRef } from 'react';
import CustomStudioV2 from '@/pages/CustomStudioV2';
import './customStudioV2MobileRepair.css';
import './customStudioV2ApprovalRefinement.css';
import './photoBootlegLayerOrder.css';
import './customStudioV2PresentationCleanup.css';

/**
 * Presentation-only boundary for the rebuilt Custom Studio.
 *
 * Keep mobile containment/rendering fixes outside editor state, production
 * composition, pricing, uploads and cart wiring so a visual repair cannot
 * silently change customer design data or fulfillment behavior.
 */
export default function CustomStudioV2PresentationGuard() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof MutationObserver === 'undefined') return undefined;

    let animationFrame = 0;
    const reviewPreviewSnapshots = new Map();

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
      root.querySelectorAll('[data-gdp-print-guide="true"]').forEach((guide) => {
        if (guide.closest('[data-gdp-final-review-preview="true"]')) return;
        const section = guide.closest('section');
        if (!section) return;

        const heading = Array.from(section.querySelectorAll('p')).find((node) => /live garment preview/i.test(node.textContent || ''));
        if (!heading) return;
        const sideMatch = (heading.textContent || '').match(/\b(front|back)\b/i);
        const side = String(sideMatch?.[1] || 'front').toLowerCase();
        const clone = section.cloneNode(true);

        clone.querySelectorAll('button,input,select,textarea').forEach((node) => node.remove());
        clone.querySelectorAll('[data-gdp-print-guide="true"]').forEach((node) => {
          node.style.borderColor = 'transparent';
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

        const clonedHeading = Array.from(clone.querySelectorAll('p')).find((node) => /live garment preview/i.test(node.textContent || ''));
        if (clonedHeading) clonedHeading.textContent = `Final garment preview · ${side}`;
        const helper = Array.from(clone.querySelectorAll('p')).find((node) => /drag with|dashed fabric box|normalized geometry/i.test(node.textContent || ''));
        if (helper) helper.remove();

        clone.setAttribute('data-gdp-final-review-preview-card', side);
        clone.className = 'overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4';
        reviewPreviewSnapshots.set(side, clone.outerHTML);
      });
    };

    const syncFinalReviewPreview = () => {
      const finalHeading = Array.from(root.querySelectorAll('h1')).find((node) => /^final review$/i.test((node.textContent || '').trim()));
      if (!finalHeading || !reviewPreviewSnapshots.size) return;
      const reviewRoot = finalHeading.parentElement;
      if (!reviewRoot || reviewRoot.querySelector('[data-gdp-final-review-preview="true"]')) return;
      const reviewGrid = Array.from(reviewRoot.children).find((node) => node.classList?.contains('mt-6') && node.classList?.contains('grid'));
      if (!reviewGrid) return;

      const container = document.createElement('div');
      container.setAttribute('data-gdp-final-review-preview', 'true');
      container.className = 'mt-5 rounded-3xl border border-slate-200 bg-slate-50/90 p-3 shadow-inner sm:p-4';
      const title = document.createElement('div');
      title.className = 'mb-3 flex flex-wrap items-end justify-between gap-2 px-1';
      title.innerHTML = '<div><p class="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Approved preview</p><h2 class="mt-1 text-lg font-black text-slate-950">Your garment with the approved artwork</h2></div><span class="rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.08em] text-emerald-800">Ready for final check</span>';
      container.appendChild(title);

      const cards = document.createElement('div');
      cards.className = reviewPreviewSnapshots.size > 1 ? 'grid gap-3 md:grid-cols-2' : 'mx-auto max-w-2xl';
      ['front', 'back'].forEach((side) => {
        const html = reviewPreviewSnapshots.get(side);
        if (html) cards.insertAdjacentHTML('beforeend', html);
      });
      container.appendChild(cards);
      reviewRoot.insertBefore(container, reviewGrid);
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

    syncPresentationLabels();
    const observer = new MutationObserver(syncPresentationLabels);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'class', 'disabled'],
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div ref={rootRef} data-gdp-studio-v2-guard="true" className="min-w-0 max-w-full overflow-x-clip">
      <CustomStudioV2 />
    </div>
  );
}