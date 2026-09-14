import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";

function sourceNav() {
  const shell = document.querySelector(".gdp-custom-studio-core");
  if (!(shell instanceof HTMLElement)) return null;
  const step = Number(shell.dataset.step || 0);
  const row = shell.querySelector("[data-studio-row]");
  const nav = shell.querySelector('[data-actions] [data-gdp-step-nav="desktop"]');
  if (!(row instanceof HTMLElement) || !(nav instanceof HTMLElement)) return null;
  const buttons = Array.from(nav.querySelectorAll("button"));
  if (buttons.length < 2) return null;
  const previous = buttons[0];
  const primary = buttons.at(-1);
  return { shell, step, row, nav, previous, primary };
}

function readState() {
  if (typeof document === "undefined" || typeof window === "undefined" || window.innerWidth < 1280) {
    return { target: null, step: 0, previousLabel: "Previous", primaryLabel: "Continue", primaryDisabled: false, primaryBlocked: false, hint: "" };
  }
  const source = sourceNav();
  if (!source || source.step <= 1) {
    return { target: null, step: source?.step || 0, previousLabel: "Previous", primaryLabel: "Continue", primaryDisabled: false, primaryBlocked: false, hint: "" };
  }
  return {
    target: source.row,
    step: source.step,
    previousLabel: String(source.previous?.textContent || "Previous").trim(),
    primaryLabel: String(source.primary?.textContent || "Continue").trim(),
    primaryDisabled: Boolean(source.primary?.disabled),
    primaryBlocked: source.primary?.getAttribute("aria-disabled") === "true",
    hint: String(source.nav.querySelector('[role="status"]')?.textContent || "").trim(),
  };
}

function sameState(a, b) {
  return a?.target === b?.target &&
    a?.step === b?.step &&
    a?.previousLabel === b?.previousLabel &&
    a?.primaryLabel === b?.primaryLabel &&
    a?.primaryDisabled === b?.primaryDisabled &&
    a?.primaryBlocked === b?.primaryBlocked &&
    a?.hint === b?.hint;
}

export default function CustomStudioNavigationDock() {
  const [state, setState] = useState(() => readState());

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return undefined;
    let frame = 0;
    const refresh = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readState();
        setState((current) => sameState(current, next) ? current : next);
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener("resize", refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!state.target || state.step <= 1) return null;

  const clickSource = (which) => {
    const source = sourceNav();
    const button = which === "previous" ? source?.previous : source?.primary;
    if (!(button instanceof HTMLButtonElement)) return;
    // Delegate to the canonical Studio navigation instead of duplicating any
    // validation, add-to-cart, approval, or checkout-state handlers here.
    button.click();
  };

  const status = state.hint || (
    state.step >= 5
      ? "Review your design, then approve it for the cart."
      : `Step ${state.step} of 5 · your current design stays saved while you move between steps.`
  );

  return createPortal(
    <div className="gdp-studio-navigation-dock" data-custom-studio-navigation-dock="true" aria-label="Custom Studio navigation">
      <button type="button" className="gdp-studio-navigation-dock__button gdp-studio-navigation-dock__button--previous" onClick={() => clickSource("previous")}>
        <ArrowLeft size={16} aria-hidden="true" /> {state.previousLabel || "Previous"}
      </button>
      <div className="gdp-studio-navigation-dock__status" aria-live="polite">
        <div className="gdp-studio-navigation-dock__eyebrow">Custom Studio · Step {state.step} of 5</div>
        <div className={"gdp-studio-navigation-dock__message" + (state.primaryBlocked ? " is-blocked" : "")}>{status}</div>
      </div>
      <button
        type="button"
        disabled={state.primaryDisabled}
        aria-disabled={state.primaryBlocked || state.primaryDisabled}
        className="gdp-studio-navigation-dock__button gdp-studio-navigation-dock__button--primary"
        onClick={() => clickSource("primary")}
      >
        {state.primaryLabel || "Continue"} <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>,
    state.target
  );
}
