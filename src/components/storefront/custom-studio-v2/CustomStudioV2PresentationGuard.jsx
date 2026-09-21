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
      });
    };

    syncPresentationLabels();
    const observer = new MutationObserver(syncPresentationLabels);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label'],
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
