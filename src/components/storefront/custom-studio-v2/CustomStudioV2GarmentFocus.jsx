import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function locateGarmentUi() {
  if (typeof document === 'undefined') return { header: null, grid: null, root: null, hasSelection: false };
  const header = document.querySelector('[data-gdp-garment-choices="top"]');
  const grid = header?.nextElementSibling || null;
  const root = header?.parentElement || null;
  const hasSelection = Boolean(grid?.querySelector('button[aria-pressed="true"]'));
  return { header, grid, root, hasSelection };
}

function sameTargets(a, b) {
  return a?.header === b?.header && a?.grid === b?.grid && a?.root === b?.root && a?.hasSelection === b?.hasSelection;
}

export default function CustomStudioV2GarmentFocus() {
  const [targets, setTargets] = useState(() => locateGarmentUi());
  const [focused, setFocused] = useState(false);
  const seenSelectionRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    let frame = 0;

    const refresh = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = locateGarmentUi();
        if (next.hasSelection && !seenSelectionRef.current) {
          seenSelectionRef.current = true;
          setFocused(true);
        } else if (!next.hasSelection) {
          seenSelectionRef.current = false;
          setFocused(false);
        }
        setTargets((current) => sameTargets(current, next) ? current : next);
      });
    };

    const onClick = (event) => {
      const button = event.target instanceof Element ? event.target.closest('button[aria-pressed]') : null;
      const current = locateGarmentUi();
      if (button && current.grid?.contains(button)) {
        window.requestAnimationFrame(() => setFocused(true));
      }
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-pressed'],
    });
    document.addEventListener('click', onClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onClick, true);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const { grid, root } = targets;
    if (!(grid instanceof HTMLElement) || !(root instanceof HTMLElement)) return undefined;

    root.dataset.gdpGarmentFocusState = focused ? 'focused' : 'browse';
    grid.dataset.gdpGarmentFocusMode = focused ? 'focused' : 'browse';

    Array.from(grid.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      const selected = Boolean(child.querySelector('button[aria-pressed="true"]'));
      child.toggleAttribute('data-gdp-focused-garment-card', selected);
      child.toggleAttribute('data-gdp-garment-choice-hidden', focused && !selected);
    });

    return () => {
      delete root.dataset.gdpGarmentFocusState;
      delete grid.dataset.gdpGarmentFocusMode;
      Array.from(grid.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        child.removeAttribute('data-gdp-focused-garment-card');
        child.removeAttribute('data-gdp-garment-choice-hidden');
      });
    };
  }, [targets, focused]);

  if (!(targets.header instanceof HTMLElement) || !targets.hasSelection) return null;

  return createPortal(
    <button
      type="button"
      data-gdp-change-garment="true"
      onClick={() => setFocused((value) => !value)}
      className="gdp-v2-change-garment"
    >
      {focused ? 'Change garment' : 'Keep current garment'}
    </button>,
    targets.header
  );
}
