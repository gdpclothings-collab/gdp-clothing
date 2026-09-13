import fs from 'node:fs';

const path = 'src/pages/CustomStudio.jsx';
let source = fs.readFileSync(path, 'utf8');

function replaceAllRequired(from, to, label, min = 1) {
  const count = source.split(from).length - 1;
  if (count < min) throw new Error(`Missing target: ${label}`);
  source = source.split(from).join(to);
  return count;
}

const marker = `  const handleContinue = () => {
    if (!canContinue()) {
      focusMissingRequirement();
      return;
    }
    setStep(step + 1);
    window.requestAnimationFrame(() => {
      document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

`;
if (!source.includes(marker)) throw new Error('Missing handleContinue marker');
const helper = marker + `  const goToStudioStep = (targetStep) => {
    const nextStep = Math.max(1, Math.min(STEPS.length, Number(targetStep || 1)));
    if (designPath === "seasonal" && nextStep === 3 && seasonalDraft) {
      setSeasonalPrepared(null);
      setRightsConfirmed(false);
      setApprovalAcknowledged(false);
      setSeasonalMode(true);
    } else if (nextStep !== 3) {
      setSeasonalMode(false);
    }
    setStep(nextStep);
    window.requestAnimationFrame(() => {
      if (designPath === "seasonal" && nextStep === 3) window.scrollTo({ top: 0, behavior: "smooth" });
      else document.getElementById("custom-studio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

`;
source = source.replace(marker, helper);

replaceAllRequired(
  'onClick={() => number < step && setStep(number)}',
  'onClick={() => number < step && goToStudioStep(number)}',
  'completed-step navigation'
);
replaceAllRequired(
  'onPrevious={() => step === 1 ? navigate(-1) : setStep(step - 1)}',
  'onPrevious={() => step === 1 ? navigate(-1) : goToStudioStep(step - 1)}',
  'previous-step navigation',
  2
);

fs.writeFileSync(path, source);
console.log('Seasonal back-navigation restored through the canonical step helper.');
