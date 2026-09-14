import React from 'react';
import SeasonalStudioLayered from './SeasonalStudioLayered.jsx';

export * from './SeasonalStudioLayered.jsx';

const STUDIO_STEPS = [
  { id: 1, label: 'Garment', complete: true },
  { id: 2, label: 'Choose Design', complete: true, backToDesign: true },
  { id: 3, label: 'Customize', active: true },
  { id: 4, label: 'Timing & Approval' },
  { id: 5, label: 'Review' },
];

export default function SeasonalStudio(props) {
  const { onBack } = props;

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

      <section className="gdp-seasonal-shared-shell__work" aria-label="Seasonal Design Lab workspace">
        <SeasonalStudioLayered {...props} />
      </section>
    </div>
  );
}
