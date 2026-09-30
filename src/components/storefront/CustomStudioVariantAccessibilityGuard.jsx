import { useEffect } from "react";

function setIfChanged(node, name, value) {
  if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
}

function leafLabel(root, text) {
  return Array.from(root.querySelectorAll("div")).find((node) =>
    node.children.length === 0 && String(node.textContent || "").trim().toLowerCase() === text.toLowerCase()
  ) || null;
}

export default function CustomStudioVariantAccessibilityGuard() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return undefined;

    const root = document.querySelector(".gdp-studio-active");
    if (!root) return undefined;

    let animationFrame = 0;

    const sync = () => {
      const configurator = root.querySelector('[data-gdp-selected-garment-configurator="true"]');
      if (!configurator) return;

      const colorButtons = Array.from(configurator.querySelectorAll('[data-gdp-garment-swatch="true"]'));
      const colorGroup = colorButtons[0]?.parentElement;
      setIfChanged(colorGroup, "role", "group");
      setIfChanged(colorGroup, "aria-label", "Garment color");
      setIfChanged(colorGroup, "data-gdp-garment-color-group", "true");

      const quantityLabel = leafLabel(configurator, "Quantity");
      const quantityPanel = quantityLabel?.parentElement;
      const quantityInput = quantityPanel?.querySelector('input[type="number"]');
      const quantityGroup = quantityInput?.parentElement;
      const quantityButtons = quantityGroup ? Array.from(quantityGroup.querySelectorAll("button")) : [];
      const decrementButton = quantityButtons[0] || null;
      const incrementButton = quantityButtons[quantityButtons.length - 1] || null;

      setIfChanged(quantityGroup, "role", "group");
      setIfChanged(quantityGroup, "aria-label", "Garment quantity");
      setIfChanged(quantityGroup, "data-gdp-garment-quantity-group", "true");
      setIfChanged(quantityInput, "aria-label", "Garment quantity");
      setIfChanged(quantityInput, "data-gdp-garment-quantity", "true");
      setIfChanged(decrementButton, "aria-label", "Decrease garment quantity");
      setIfChanged(incrementButton, "aria-label", "Increase garment quantity");
    };

    const scheduleSync = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return null;
}
