import React, { useRef, useState } from 'react';
import SeasonalStudioLayered from './SeasonalStudioLayered.jsx';

// Compatibility contract: this module still provides the same default entrypoint
// that historically used: export { default } from './SeasonalStudioLayered.jsx';
// The wrapper below changes presentation only; all layered editor behavior remains
// implemented by SeasonalStudioLayered.
export * from './SeasonalStudioLayered.jsx';

const STUDIO_STEPS = [
  { id: 1, label: 'Garment', complete: true },
  { id: 2, label: 'Choose Design', complete: true, backToDesign: true },
  { id: 3, label: 'Customize', active: true },
  { id: 4, label: 'Timing & Approval' },
  { id: 5, label: 'Review' },
];

const MOBILE_PANELS = [
  { id: 'artwork', label: 'Artwork' },
  { id: 'preview', label: 'Preview' },
  { id: 'layers', label: 'Layers' },
];

export default function SeasonalStudio(props) {
  const { onBack, initialDraft } = props;
  const workspaceRef = useRef(null);
  const hasRestoredArtwork = Boolean(initialDraft?.layers?.length || initialDraft?.artworkId);
  const [mobilePanel, setMobilePanel] = useState(() => hasRestoredArtwork ? 'preview' : 'artwork');

  const selectMobilePanel = (panel, { scroll = true } = {}) => {
    setMobilePanel(panel);
    if (!scroll || typeof window === 'undefined') return;
    window.setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const handleWorkspaceClickCapture = (event) => {
    if (!(event.target instanceof Element)) return;

    // Preserve the editor's existing behavior of showing the garment immediately
    // after an artwork is added, but do it without forcing the customer through a
    // long mobile scroll. Desktop/tablet ignore this state through CSS.
    const artworkCard = event.target.closest('section[aria-label="Choose seasonal artwork"] button.group');
    if (artworkCard instanceof HTMLButtonElement && !artworkCard.disabled) {
      selectMobilePanel('preview');
      return;
    }

    const button = event.target.closest('button');
    const label = button?.textContent?.trim().toLowerCase() || '';
    if (label.includes('layers & controls')) selectMobilePanel('layers');
  };

  return (
    <div className="gdp-seasonal-shared-shell" data-seasonal-shared-shell>
      <header className="gdp-seasonal-shared-shell__hero">
        <div>
          <div className="gdp-seasonal-shared-shell__eyebrow">GDP Custom Studio · Seasonal Designs</div>
          <div className="gdp-seasonal-shared-shell__title">SEASONAL DESIGN LAB</div>
        </div>
        <div className="gdp-seasonal-shared-shell__status">Layered artwork · live garment preview</div>
      </header>

      <aside className="gdp-seasonal-shared-shell__rail" aria-label="Custom Studio steps">
        {STUDIO_STEPS.map((step) => {
          const content = (
            <>
              <span className="gdp-seasonal-shared-shell__step-number" aria-hidden="true">
                {step.complete ? '✓' : step.id}
              </span>
              <span className="gdp-seasonal-shared-shell__step-copy">{step.label}</span>
            </>
          );

          if (step.backToDesign) {
            return (
              <button
                key={step.id}
                type="button"
                className="gdp-seasonal-shared-shell__step"
                data-complete="true"
                onClick={onBack}
                title="Return to design path selection"
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={step.id}
              className="gdp-seasonal-shared-shell__step"
              data-active={step.active ? 'true' : 'false'}
              data-complete={step.complete ? 'true' : 'false'}
              aria-current={step.active ? 'step' : undefined}
            >
              {content}
            </div>
          );
        })}

        <div className="gdp-seasonal-shared-shell__rail-note">
          Choose Design returns to all design paths. Seasonal artwork, layer order, placement, and edits stay inside the same Custom Studio workspace.
        </div>
      </aside>

      <section ref={workspaceRef} className="gdp-seasonal-shared-shell__work" aria-label="Seasonal Design Lab workspace">
        <nav className="gdp-seasonal-mobile-tabs" aria-label="Seasonal editor panels">
          {MOBILE_PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              aria-pressed={mobilePanel === panel.id}
              onClick={() => selectMobilePanel(panel.id)}
              className="gdp-seasonal-mobile-tabs__button"
            >
              {panel.label}
            </button>
          ))}
        </nav>

        <div
          data-seasonal-mobile-panel={mobilePanel}
          onClickCapture={handleWorkspaceClickCapture}
        >
          <SeasonalStudioLayered {...props} />
        </div>
      </section>
    </div>
  );
}
