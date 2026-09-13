import fs from 'node:fs';

const path = 'src/pages/CustomStudio.jsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Missing target: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Non-unique target: ${label}`);
  source = source.slice(0, first) + to + source.slice(first + from.length);
}

replaceOnce(
  '<StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text="The preview you approve is converted into the exact 300 DPI production file before it enters your cart." />',
  '<StepTitle eyebrow="Approve the result" title="TIMING + FINAL APPROVAL" text={designPath === "seasonal" ? "Your exact 300 DPI seasonal composite is prepared below. Confirm timing, artwork rights and this exact preview before it can enter your cart." : "The preview you approve is converted into the exact 300 DPI production file before it enters your cart."} />',
  'Step 4 Seasonal approval copy'
);

replaceOnce(
  '<StepTitle eyebrow="Final check" title="REVIEW THE EXACT RESULT" text="Adding to cart generates and locks the production-ready PNG from the live preview. Payment then sends that same file to the production queue." />',
  '<StepTitle eyebrow="Final check" title="REVIEW THE EXACT RESULT" text={designPath === "seasonal" ? "This is the prepared seasonal production composite you approved. Adding it to cart locks that exact 300 DPI file to the order." : "Adding to cart generates and locks the production-ready PNG from the live preview. Payment then sends that same file to the production queue."} />',
  'Step 5 Seasonal review copy'
);

replaceOnce(
  '{placement !== "back" && <ReviewCard label="Front artwork" value={printSummaryForSide("front")} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}',
  '{designPath !== "seasonal" && placement !== "back" && <ReviewCard label="Front artwork" value={printSummaryForSide("front")} sub={"Scale " + Number(artworkStates.front?.scale ?? 92) + "% · rotation " + Number(artworkStates.front?.rotation ?? 0) + "°"} />}',
  'hide generic front artwork for Seasonal'
);
replaceOnce(
  '{placement !== "front" && <ReviewCard label="Back artwork" value={printSummaryForSide("back")} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}',
  '{designPath !== "seasonal" && placement !== "front" && <ReviewCard label="Back artwork" value={printSummaryForSide("back")} sub={"Scale " + Number(artworkStates.back?.scale ?? 92) + "% · rotation " + Number(artworkStates.back?.rotation ?? 0) + "°"} />}',
  'hide generic back artwork for Seasonal'
);
replaceOnce(
  '<ReviewCard label="Production result" value="Customer-approved preview" sub="Locked 300 DPI PNG is generated when added to cart." />',
  '<ReviewCard label="Production result" value="Customer-approved preview" sub={designPath === "seasonal" ? "Prepared 300 DPI layered composite · locked to this approval when added to cart." : "Locked 300 DPI PNG is generated when added to cart."} />',
  'Seasonal production result copy'
);

const previewPattern = /              <StudioPreview\n[\s\S]*?preferEditablePhotoLayers=\{designPath === "bootleg" \|\| designPath === "memorial"\} \/>/;
const matches = source.match(previewPattern);
if (!matches) throw new Error('Missing shared garment preview target');
const originalPreview = matches[0];
const seasonalPreview = `              {designPath === "seasonal" && step >= 4 && seasonalPrepared?.cartItemBase?.image ? (\n                <div className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[#F3EEE6] p-4 sm:p-6" data-seasonal-approved-preview>\n                  <img src={seasonalPrepared.cartItemBase.image} alt="Exact prepared Seasonal Design garment preview" className="h-full w-full object-contain" />\n                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-200 bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 shadow-sm">Exact prepared preview · 300 DPI composite</div>\n                </div>\n              ) : (\n${originalPreview}\n              )}`;
source = source.replace(previewPattern, seasonalPreview);

fs.writeFileSync(path, source);
console.log('Seasonal shared approval preview patched.');
