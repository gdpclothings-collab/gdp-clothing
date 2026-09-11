import { useEffect } from "react";
import { ArrowRight, Check } from "lucide-react";

const AFTER_ORDER_STEPS = [
  "Order received",
  "Payment confirmed",
  "Approved file locked",
  "Printing",
  "Quality check",
  "Pickup / shipping",
];

function detectStudioStep(root) {
  const stepLabel = Array.from(root.querySelectorAll("span")).find((element) =>
    /^Step\s+\d+\s+of\s+\d+$/i.test(String(element.textContent || "").trim())
  );
  const match = String(stepLabel?.textContent || "").trim().match(/^Step\s+(\d+)\s+of\s+\d+$/i);
  if (match) root.dataset.gdpStudioStep = match[1];
  else delete root.dataset.gdpStudioStep;
}

function customOrderGuideButton(root) {
  return Array.from(root.querySelectorAll("button")).find((button) =>
    /how\s+custom\s+orders\s+work/i.test(String(button.textContent || ""))
  ) || null;
}

export default function CustomStudioShellEnhancer() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;
    const root = document.querySelector(".gdp-studio-active");
    if (!root) return undefined;

    const mobile = window.matchMedia("(max-width: 767px)");
    let appliedMobileStepOneDefault = false;

    const sync = () => {
      detectStudioStep(root);

      // Mobile Step 1 starts with the guide collapsed to keep garment choices
      // near the top of the screen. Apply this default only once so a customer
      // can freely reopen the guide without MutationObserver closing it again.
      if (!appliedMobileStepOneDefault && mobile.matches && root.dataset.gdpStudioStep === "1") {
        const button = customOrderGuideButton(root);
        if (!button) return;
        if (button.getAttribute("aria-expanded") === "true") button.click();
        appliedMobileStepOneDefault = true;
      }
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-expanded"] });

    return () => {
      observer.disconnect();
      delete root.dataset.gdpStudioStep;
    };
  }, []);

  return (
    <div className="gdp-custom-studio-after-order mx-auto w-full max-w-[1540px] px-4 pb-7 pt-1 lg:px-8 lg:pb-10">
      <section className="overflow-hidden rounded-[24px] border border-[#263442] bg-[#17212B] px-5 py-5 text-white shadow-[0_18px_48px_rgba(13,25,36,.16)] sm:px-6 sm:py-6" aria-label="After you order">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">After you order</div>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm font-semibold text-white/88">
          {AFTER_ORDER_STEPS.map((item, index) => (
            <span key={item} className="contents">
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Check size={15} className="shrink-0 text-[#D9273E]" />
                {item}
              </span>
              {index < AFTER_ORDER_STEPS.length - 1 && <ArrowRight size={13} className="hidden shrink-0 text-white/25 sm:block" />}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
