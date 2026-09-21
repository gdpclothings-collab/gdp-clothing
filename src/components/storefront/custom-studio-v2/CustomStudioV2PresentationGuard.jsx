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

    const syncPresentationLabels = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
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
      });
    };

    syncPresentationLabels();
    const observer = new MutationObserver(syncPresentationLabels);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
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
