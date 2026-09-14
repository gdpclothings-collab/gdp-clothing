import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import CustomStudioDesktopWorkspaceV12 from "@/pages/CustomStudioDesktopWorkspaceV12";
import { customerApi } from "@/lib/customerApi";
import { clearStudioEditIntent, readCurrentStudioDraft } from "@/lib/customStudioDraftBridge";

const DESKTOP_BREAKPOINT = 1280;
const DEFAULT_STANDARD_LEAD_DAYS = 7;
const DEFAULT_RUSH_LEAD_DAYS = 3;

const styles = `
.gdp-custom-studio-v13 {
  width: 100%;
  min-width: 0;
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  /* Help drawer must reserve space on every main Studio step, not only Step 1. */
  .gdp-custom-studio-v13[data-guide-open="true"] .gdp-custom-studio-v7 [data-studio-row] {
    width: calc(100% - var(--gdp-guide-drawer-width, 420px) - 16px) !important;
    transform: translateX(calc(var(--gdp-guide-drawer-width, 420px) + 16px)) !important;
  }

  /* A recovery modal is a real modal: nothing in the rail/drawer may rise above it. */
  .gdp-custom-studio-v13 [aria-labelledby="saved-studio-draft-title"] {
    z-index: 1400 !important;
  }

  .gdp-custom-studio-v13[data-modal-open="true"] .gdp-custom-studio-v7 [data-guide] > button {
    pointer-events: none !important;
    opacity: .48 !important;
  }

  /* Step 1 actions remain visible while the configuration panel scrolls. */
  .gdp-custom-studio-v13 .gdp-step1-bottom-dock {
    position: sticky !important;
    bottom: 8px !important;
    z-index: 180 !important;
  }

  /* Replace the CSS pseudo-label with a real accessible control. */
  .gdp-custom-studio-v13 .gdp-custom-studio-v7[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    display: none !important;
    content: none !important;
  }

  .gdp-change-garment-button {
    position: absolute;
    top: 14px;
    right: 14px;
    z-index: 25;
    display: inline-flex;
    min-height: 34px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid #C8D4DE;
    border-radius: 999px;
    background: rgba(255,255,255,.97);
    padding: 7px 11px;
    color: #17324D;
    box-shadow: 0 8px 20px rgba(23,50,77,.11);
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .045em;
    text-transform: uppercase;
  }

  .gdp-change-garment-button:hover { background: #F7FAFC; border-color: #8FA3B5; }
  .gdp-change-garment-button:focus-visible { outline: 2px solid #17324D; outline-offset: 2px; }

  /* One selected-color indicator is enough. */
  .gdp-custom-studio-v13 .gdp-custom-studio-v7[data-step="1"] [data-step1-color] > div:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-v13 [data-gdp-after-order-strip="true"] {
    display: none !important;
  }

  .gdp-guide-after-order {
    margin: 12px;
    border: 1px solid #DCE3EA;
    border-radius: 14px;
    background: #F7FAFC;
    padding: 12px;
    color: #17324D;
  }

  .gdp-guide-after-order__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #7A8996;
  }

  .gdp-guide-after-order__flow {
    margin-top: 7px;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.5;
  }

  .gdp-lead-time-note,
  .gdp-dpi-status {
    margin-top: 8px;
    border-radius: 11px;
    padding: 9px 11px;
    font-size: 11px;
    line-height: 1.4;
  }

  .gdp-lead-time-note { background: #F5F8FA; color: #52616F; }
  .gdp-lead-time-note[data-invalid="true"] { background: #FFF7ED; color: #9A4D13; }
  .gdp-dpi-status { border: 1px solid #DCE3EA; background: #F7FAFC; color: #52616F; }
  .gdp-dpi-status[data-level="low"] { border-color: #F1C08C; background: #FFF7ED; color: #8C4B18; }
  .gdp-dpi-status[data-level="good"] { border-color: #C9DDD1; background: #F2F8F4; color: #285A3D; }
}
`;

const normalize = (value) => String(value || "").toLowerCase().replace(/grey/g, "gray").replace(/[^a-z0-9]+/g, " ").trim();

function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
}

function selectedColor(section) {
  const buttons = Array.from(section?.querySelectorAll("button") || []);
  const selected = buttons.find((button) => {
    const classes = String(button.className || "");
    return classes.includes("bg-[#17324D]") && classes.includes("text-white");
  });
  return String(selected?.textContent || "").trim();
}

function selectedGarmentCard(shell) {
  return shell?.querySelector('[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent') ||
    shell?.querySelector('[data-step="1"] [data-garment-grid] > button.border-accent') || null;
}

function productForCard(catalog, card) {
  const name = String(card?.querySelector(".font-bold.leading-tight")?.textContent || "").trim();
  if (!name) return null;
  return catalog.find((product) => normalize(product?.name) === normalize(name)) || null;
}

function colorMockup(product, color) {
  if (!product || !color) return "";
  const customization = product.customization || {};
  const mockups = customization?.preview?.colorMockups || {};
  const mockupKey = Object.keys(mockups).find((key) => normalize(key) === normalize(color));
  const configured = mockupKey ? mockups[mockupKey]?.frontUrl : "";
  if (configured) return configured;

  const media = customization?.media || {};
  const mediaEntry = Object.entries(media).find(([, meta]) =>
    normalize(meta?.color) === normalize(color) && normalize(meta?.view || "front") === "front"
  );
  if (mediaEntry?.[0]) return mediaEntry[0];

  const token = normalize(color);
  return (product.images || []).find((url) => {
    const file = normalize(String(url).split("/").pop());
    if (file.includes("back") || file.includes("rear")) return false;
    if (token === "royal") return file.includes("royal") || (file.includes("blue") && !file.includes("navy"));
    return file.includes(token);
  }) || "";
}

function addDaysISO(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + Math.max(0, Number(days || 0)));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function printProfile(product, size, placement) {
  const guide = product?.customization?.preview?.printGuide || {};
  const side = placement === "back" ? "back" : "front";
  const base = guide?.[side] || guide?.front || guide?.back || {};
  const override = base?.sizeOverrides?.[size] || {};
  return {
    widthIn: Number(override.widthIn || base.widthIn || base.maxWidthIn || 12),
    heightIn: Number(override.heightIn || base.heightIn || base.maxHeightIn || 14),
  };
}

function estimatedPhotoDpi(draft, catalog) {
  const photos = Array.isArray(draft?.photos) ? draft.photos.filter((photo) => Number(photo?.width) > 0 && Number(photo?.height) > 0) : [];
  if (!photos.length) return null;
  const product = catalog.find((entry) => String(entry?.id) === String(draft?.productId)) || null;
  if (!product) return null;
  const profile = printProfile(product, draft?.size, draft?.placement);
  if (!(profile.widthIn > 0 && profile.heightIn > 0)) return null;
  const values = photos.map((photo) => {
    const width = Number(photo.width);
    const height = Number(photo.height);
    const normal = Math.min(width / profile.widthIn, height / profile.heightIn);
    const rotated = Math.min(width / profile.heightIn, height / profile.widthIn);
    return Math.floor(Math.max(normal, rotated));
  });
  return Math.min(...values);
}

function findAfterOrderStrip(host) {
  const labels = Array.from(host?.querySelectorAll("div,span,p") || []).filter((node) => normalize(node.textContent) === "after you order");
  for (const label of labels) {
    let node = label.parentElement;
    while (node && node !== host) {
      const text = normalize(node.textContent);
      if (text.includes("order received") && text.includes("payment confirmed") && (text.includes("pickup shipping") || text.includes("pickup") || text.includes("shipping"))) {
        return node;
      }
      node = node.parentElement;
    }
  }
  return null;
}

export default function CustomStudioDesktopWorkspaceV13() {
  const hostRef = useRef(null);
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState({ standardLeadDays: DEFAULT_STANDARD_LEAD_DAYS, rushLeadDays: DEFAULT_RUSH_LEAD_DAYS });
  const [selectedCard, setSelectedCard] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePanel, setGuidePanel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([customerApi.getStudioCatalog(), customerApi.getCustomStudioSettings()]).then(([catalogResult, settingsResult]) => {
      if (!active) return;
      if (catalogResult.status === "fulfilled") setCatalog(catalogResult.value || []);
      if (settingsResult.status === "fulfilled") {
        const next = settingsResult.value || {};
        setSettings({
          standardLeadDays: Math.max(1, Number(next.standardLeadDays || DEFAULT_STANDARD_LEAD_DAYS)),
          rushLeadDays: Math.max(1, Number(next.rushLeadDays || DEFAULT_RUSH_LEAD_DAYS)),
        });
      }
    });
    return () => { active = false; };
  }, []);

  const catalogSignature = useMemo(() => catalog.map((product) => `${product.id}:${product.name}`).join("|"), [catalog]);

  const refine = useCallback(() => {
    const host = hostRef.current;
    if (!host || !isDesktop()) return;
    const shell = host.querySelector(".gdp-custom-studio-v7");
    if (!shell) return;

    const guide = shell.querySelector("[data-guide]");
    const guideButton = guide?.querySelector(":scope > button");
    const panel = guide?.querySelector(":scope > div") || null;
    const nextGuideOpen = Boolean(guideButton && guideButton.getAttribute("aria-expanded") === "true" && panel);
    const draftModal = host.querySelector('[aria-labelledby="saved-studio-draft-title"]');
    const nextModalOpen = Boolean(draftModal);

    if (nextModalOpen && nextGuideOpen && guideButton instanceof HTMLButtonElement) {
      guideButton.click();
    }

    setGuideOpen((current) => current === (nextModalOpen ? false : nextGuideOpen) ? current : (nextModalOpen ? false : nextGuideOpen));
    setGuidePanel((current) => current === panel ? current : panel);
    setModalOpen((current) => current === nextModalOpen ? current : nextModalOpen);

    const afterOrder = findAfterOrderStrip(host);
    afterOrder?.setAttribute("data-gdp-after-order-strip", "true");

    if (shell.dataset.step === "1") {
      const card = selectedGarmentCard(shell);
      setSelectedCard((current) => current === card ? current : card);
      const colorSection = shell.querySelector("[data-step1-color]");
      const color = selectedColor(colorSection);
      const product = productForCard(catalog, card);
      const exactUrl = colorMockup(product, color);
      if (card && exactUrl) {
        const cardImage = card.querySelector(":scope > div:first-child img");
        if (cardImage instanceof HTMLImageElement && cardImage.getAttribute("src") !== exactUrl) {
          cardImage.setAttribute("src", exactUrl);
          cardImage.dataset.gdpExactColor = color;
        }
        // V8 mirrors the first live preview into the selected summary. Keep that
        // preview on the exact product/color asset so the older guard converges
        // to the same correct value rather than fighting this layer.
        const preview = shell.querySelector('[data-preview-card] img[alt*="front mockup"]');
        if (preview instanceof HTMLImageElement && preview.getAttribute("src") !== exactUrl) {
          preview.setAttribute("src", exactUrl);
        }
      }

      const sizeSection = shell.querySelector("[data-step1-size]");
      Array.from(sizeSection?.querySelectorAll("button:disabled") || []).forEach((button) => {
        if (color) {
          button.title = `Unavailable in ${color}`;
          button.setAttribute("aria-label", `${String(button.textContent || "").trim()} unavailable in ${color}`);
        }
      });
    } else {
      setSelectedCard((current) => current === null ? current : null);
    }

    if (shell.dataset.step === "4") {
      const workspace = shell.querySelector("[data-workspace]") || shell;
      const dateInput = workspace.querySelector('input[type="date"]');
      const choiceButtons = Array.from(workspace.querySelectorAll("button"));
      const rushButton = choiceButtons.find((button) => normalize(button.textContent).startsWith("rush"));
      const rushActive = Boolean(rushButton && String(rushButton.className || "").includes("border-accent"));
      const days = rushActive ? settings.rushLeadDays : settings.standardLeadDays;
      const minDate = addDaysISO(days);
      if (dateInput instanceof HTMLInputElement) {
        dateInput.min = minDate;
        const invalid = Boolean(dateInput.value && dateInput.value < minDate);
        dateInput.setCustomValidity(invalid ? `Choose ${minDate} or later for the selected production speed.` : "");
        let note = dateInput.parentElement?.querySelector("[data-gdp-lead-time-note]");
        if (!note && dateInput.parentElement) {
          note = document.createElement("div");
          note.setAttribute("data-gdp-lead-time-note", "true");
          note.className = "gdp-lead-time-note";
          dateInput.parentElement.appendChild(note);
        }
        if (note) {
          note.setAttribute("data-invalid", invalid ? "true" : "false");
          note.textContent = invalid
            ? `That date is inside the current production buffer. Earliest ${rushActive ? "Rush" : "Standard"} date: ${minDate}.`
            : `Earliest ${rushActive ? "Rush" : "Standard"} date: ${minDate} (${days}-day production buffer).`;
        }
        const continueButton = Array.from(shell.querySelectorAll("[data-actions] button")).find((button) => normalize(button.textContent).includes("continue"));
        if (continueButton instanceof HTMLButtonElement) {
          if (invalid && continueButton.dataset.gdpLeadBlocked !== "true") {
            continueButton.dataset.gdpLeadBlocked = "true";
            continueButton.dataset.gdpPriorDisabled = continueButton.disabled ? "true" : "false";
            continueButton.disabled = true;
          } else if (!invalid && continueButton.dataset.gdpLeadBlocked === "true") {
            const wasDisabled = continueButton.dataset.gdpPriorDisabled === "true";
            delete continueButton.dataset.gdpLeadBlocked;
            delete continueButton.dataset.gdpPriorDisabled;
            continueButton.disabled = wasDisabled;
          }
        }
      }

      const approvalLabel = Array.from(workspace.querySelectorAll("label")).find((label) => normalize(label.textContent).includes("i approve the exact live preview shown"));
      const approvalSpan = approvalLabel?.querySelector("span");
      if (approvalSpan && approvalSpan.dataset.gdpEditPolicyRefined !== "true") {
        Array.from(approvalSpan.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && String(node.textContent || "").includes("To change it, I must create a new design before checkout.")) {
            node.textContent = String(node.textContent).replace(
              "To change it, I must create a new design before checkout.",
              "Editing this design from the cart reopens it and requires approval again before checkout."
            );
          }
        });
        approvalSpan.dataset.gdpEditPolicyRefined = "true";
      }
    }

    if (shell.dataset.step === "5") {
      const draft = readCurrentStudioDraft();
      const dpi = estimatedPhotoDpi(draft, catalog);
      const approveButton = Array.from(shell.querySelectorAll("button")).find((button) => normalize(button.textContent).includes("approve lock add to cart"));
      if (approveButton?.parentElement) {
        let status = approveButton.parentElement.querySelector("[data-gdp-dpi-status]");
        if (dpi && !status) {
          status = document.createElement("div");
          status.setAttribute("data-gdp-dpi-status", "true");
          status.className = "gdp-dpi-status";
          approveButton.parentElement.insertBefore(status, approveButton);
        }
        if (status && dpi) {
          const level = dpi >= 220 ? "good" : dpi < 150 ? "low" : "warning";
          status.setAttribute("data-level", level);
          status.textContent = dpi >= 300
            ? `Print quality: approximately ${dpi} DPI at the recommended print area — excellent.`
            : dpi >= 220
              ? `Print quality: approximately ${dpi} DPI at the recommended print area — good for production.`
              : dpi >= 150
                ? `Print quality: approximately ${dpi} DPI — usable, but a higher-resolution photo is recommended.`
                : `Print quality: approximately ${dpi} DPI — low resolution. Replace the photo before production when possible.`;
        }
      }
    }
  }, [catalog, catalogSignature, settings.rushLeadDays, settings.standardLeadDays]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof MutationObserver === "undefined") return undefined;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        refine();
      });
    };
    refine();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "src", "aria-expanded", "data-step", "data-gdp-collapsed", "value", "disabled"],
    });
    document.addEventListener("change", schedule, true);
    document.addEventListener("click", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      document.removeEventListener("change", schedule, true);
      document.removeEventListener("click", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [refine]);

  useEffect(() => {
    const onClick = (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (button && normalize(button.textContent).startsWith("start fresh")) clearStudioEditIntent();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const expandGarments = () => {
    const card = selectedCard;
    const grid = card?.closest?.("[data-garment-grid]");
    if (!grid) return;
    grid.dataset.gdpUserExpanded = "true";
    grid.dataset.gdpCollapsed = "false";
    window.requestAnimationFrame(() => {
      const first = grid.querySelector("button");
      if (first instanceof HTMLButtonElement) first.focus({ preventScroll: true });
    });
  };

  return (
    <div
      ref={hostRef}
      className="gdp-custom-studio-v13"
      data-guide-open={guideOpen ? "true" : "false"}
      data-modal-open={modalOpen ? "true" : "false"}
    >
      <style>{styles}</style>
      <CustomStudioDesktopWorkspaceV12 />

      {selectedCard && typeof document !== "undefined" && createPortal(
        <button type="button" className="gdp-change-garment-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); expandGarments(); }} aria-label="Change garment">
          <RotateCcw size={12} /> Change garment
        </button>,
        selectedCard
      )}

      {guideOpen && guidePanel && typeof document !== "undefined" && createPortal(
        <div className="gdp-guide-after-order" aria-label="After you order">
          <div className="gdp-guide-after-order__eyebrow">After you order</div>
          <div className="gdp-guide-after-order__flow">Order received → Payment confirmed → Approved file locked → Printing → Quality check → Pickup / shipping</div>
        </div>,
        guidePanel
      )}
    </div>
  );
}
