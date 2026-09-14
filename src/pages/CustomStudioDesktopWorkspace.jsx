import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import CustomStudio from "@/pages/CustomStudio";
import { useNotifications } from "@/lib/NotificationContext";
import { customerApi } from "@/lib/customerApi";
import { clearStudioEditIntent, readCurrentStudioDraft } from "@/lib/customStudioDraftBridge";

const DESKTOP_BREAKPOINT = 1280;
const FALLBACK_DELAY_MS = 90;
const MAX_POINTER_TRAVEL_PX = 14;
const STUDIO_DRAFT_KEY = "gdp.custom-studio.draft.v2";
const STEP_ONE_VALIDATION = "Choose an available size before continuing.";
const DEFAULT_STANDARD_LEAD_DAYS = 7;
const DEFAULT_RUSH_LEAD_DAYS = 3;
const STUDIO_STEPS = ["Garment", "Choose Design", "Customize", "Timing & Approval", "Review"];

const styles = `
/* Retired V7 base layout */

@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-core {
    --gdp-rail: 204px;
    --gdp-config: 462px;
    --gdp-gap: 14px;
  }

  .gdp-custom-studio-core [data-studio-container] {
    display: grid !important;
    grid-template-columns: var(--gdp-rail) minmax(0, 1fr) !important;
    grid-template-areas: "hero hero" "rail work" !important;
    column-gap: var(--gdp-gap) !important;
    row-gap: 9px !important;
    width: 100% !important;
    max-width: 1920px !important;
    margin: 0 auto !important;
    padding: 9px 18px 14px !important;
  }

  .gdp-custom-studio-core [data-studio-hero] {
    grid-area: hero !important;
    min-height: 46px !important;
    margin: 0 !important;
    padding: 8px 14px !important;
    border-radius: 16px !important;
  }

  .gdp-custom-studio-core [data-studio-hero] h1 {
    margin-top: 1px !important;
    font-size: clamp(1.3rem, 1.6vw, 1.72rem) !important;
    line-height: 1 !important;
  }

  .gdp-custom-studio-core [data-studio-hero] p,
  .gdp-custom-studio-core[data-step="1"] [data-studio-hero] > div > div:last-child {
    display: none !important;
  }

  .gdp-custom-studio-core [data-studio-rail] {
    grid-area: rail !important;
    position: sticky !important;
    top: 66px !important;
    z-index: 40 !important;
    align-self: stretch !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    height: calc(100dvh - 142px) !important;
    min-height: 540px !important;
    max-height: calc(100dvh - 142px) !important;
    margin: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    scrollbar-width: thin;
  }

  .gdp-custom-studio-core [data-mobile-progress] {
    display: none !important;
  }

  .gdp-custom-studio-core [data-stepper] {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 0 !important;
    flex: 0 0 auto !important;
    overflow: visible !important;
    padding: 7px !important;
    border-radius: 16px !important;
    background: rgba(255, 255, 255, .98) !important;
    box-shadow: 0 10px 28px rgba(23, 50, 77, .06) !important;
  }

  .gdp-custom-studio-core [data-stepper] > button {
    width: 100% !important;
    min-height: 43px !important;
    justify-content: flex-start !important;
    padding: 8px 9px !important;
    white-space: normal !important;
    text-align: left !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-stepper] > button > span:last-child {
    font-size: 9.5px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-core [data-stepper] > div {
    width: 1px !important;
    min-width: 0 !important;
    height: 7px !important;
    flex: 0 0 7px !important;
    margin-left: 19px !important;
  }

  /* The order guide is an inline rail accordion on desktop. It never floats over controls. */
  .gdp-custom-studio-core [data-guide] {
    position: relative !important;
    flex: 0 0 auto !important;
    margin: 2px 0 0 !important;
    overflow: visible !important;
  }

  .gdp-custom-studio-core [data-guide] > button {
    width: 100% !important;
    min-height: 42px !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-guide] > button > span:first-child > span:last-child {
    display: none !important;
  }

  .gdp-custom-studio-core [data-guide] > div {
    position: static !important;
    inset: auto !important;
    z-index: auto !important;
    width: 100% !important;
    max-width: 100% !important;
    max-height: 290px !important;
    margin-top: 7px !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    border: 1px solid #DCE3EA !important;
    border-radius: 14px !important;
    background: #FFFFFF !important;
    box-shadow: none !important;
    transform: none !important;
  }

  .gdp-custom-studio-core [data-guide] > div > div:first-child > div {
    grid-template-columns: 1fr !important;
  }

  .gdp-custom-studio-core [data-guide] h2,
  .gdp-custom-studio-core [data-guide] h3 {
    font-size: 11px !important;
    line-height: 1.25 !important;
  }

  .gdp-custom-studio-core [data-guide] p,
  .gdp-custom-studio-core [data-guide] li {
    font-size: 9.5px !important;
    line-height: 1.35 !important;
  }

  .gdp-custom-studio-core [data-actions] {
    position: relative !important;
    z-index: 45 !important;
    flex: 0 0 auto !important;
    margin: 0 !important;
  }

  .gdp-custom-studio-core [data-actions] [data-gdp-step-nav="desktop"] {
    padding: 7px !important;
    border-radius: 15px !important;
    background: rgba(255, 255, 255, .99) !important;
    box-shadow: 0 10px 28px rgba(23, 50, 77, .06) !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-actions] [data-gdp-step-nav="desktop"] > div:first-child {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }

  .gdp-custom-studio-core [data-actions] [data-gdp-step-nav="desktop"] button {
    width: 100% !important;
    justify-content: center !important;
    pointer-events: auto !important;
    position: relative !important;
    z-index: 2 !important;
  }

  .gdp-custom-studio-core [data-actions] [data-gdp-step-nav="desktop"] > p {
    margin-top: 6px !important;
    border-radius: 9px !important;
    background: #FFF7ED !important;
    padding: 7px 8px !important;
    text-align: left !important;
    line-height: 1.3 !important;
  }

  .gdp-custom-studio-core [data-studio-row] {
    grid-area: work !important;
    display: grid !important;
    grid-template-columns: var(--gdp-config) minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) !important;
    gap: var(--gdp-gap) !important;
    width: 100% !important;
    min-width: 0 !important;
    height: calc(100dvh - 142px) !important;
    min-height: 540px !important;
    max-height: calc(100dvh - 142px) !important;
    overflow: hidden !important;
  }

  .gdp-custom-studio-core [data-workspace] {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    overscroll-behavior: contain;
    padding: 15px !important;
    border-radius: 20px !important;
    scrollbar-width: thin;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-aside] {
    grid-column: 2 !important;
    grid-row: 1 !important;
    position: relative !important;
    top: auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow: hidden !important;
    padding: 0 !important;
    gap: 0 !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-aside] > .lg\\:hidden {
    display: none !important;
  }

  .gdp-custom-studio-core [data-preview-card] {
    position: relative !important;
    top: auto !important;
    display: flex !important;
    flex: 1 1 auto !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    border-radius: 22px !important;
    box-shadow: 0 20px 56px rgba(23, 50, 77, .10) !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-preview-card] > :first-child {
    position: relative !important;
    z-index: 30 !important;
    flex: 0 0 auto !important;
    padding: 9px 12px !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-preview-card] > :first-child button {
    position: relative !important;
    z-index: 35 !important;
    pointer-events: auto !important;
  }

  .gdp-custom-studio-core [data-preview-card] > :nth-child(2) {
    flex: 1 1 auto !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
  }

  .gdp-custom-studio-core:not([data-step="5"]) [data-order-card] {
    display: none !important;
  }

  /* STEP 1: compact choices, stable center card, full live preview. */
  .gdp-custom-studio-core[data-step="1"] [data-workspace] > div > :first-child {
    margin-bottom: 14px !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-workspace] > div > :first-child h2 {
    font-size: 1.75rem !important;
    line-height: 1.05 !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
    align-items: start !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button {
    min-width: 0 !important;
    width: 100% !important;
    border-radius: 14px !important;
    transform: none !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :first-child {
    height: 116px !important;
    min-height: 116px !important;
    aspect-ratio: auto !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :last-child {
    padding: 9px 10px !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :last-child .font-bold {
    font-size: 12px !important;
    line-height: 1.15 !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] {
    grid-template-columns: minmax(0, 216px) !important;
    justify-content: center !important;
    justify-items: center !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button:not(.border-accent) {
    display: none !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    width: 216px !important;
    max-width: 216px !important;
    margin-inline: auto !important;
    transform: none !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    content: "Selected · Click to change";
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 6;
    display: inline-flex;
    align-items: center;
    min-height: 26px;
    padding: 5px 7px;
    border-radius: 999px;
    background: rgba(23, 50, 77, .94);
    color: #fff;
    box-shadow: 0 6px 16px rgba(15, 23, 42, .12);
    font-size: 8px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: .035em;
    text-transform: uppercase;
    pointer-events: none;
  }

  .gdp-custom-studio-core[data-step="1"] [data-step1-group] {
    margin-top: 16px !important;
    padding-top: 12px !important;
    border-top: 1px solid #E7EBEF !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-step1-group] > p {
    display: none !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-step1-group] .font-bold {
    font-size: 12px !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-step1-group] button {
    min-height: 38px !important;
    pointer-events: auto !important;
  }

  /* There is one Continue path on desktop: the persistent rail action. */
  .gdp-custom-studio-core[data-step="1"] [data-step1-complete] {
    display: none !important;
  }

  /* Keep the live garment centered and comfortably large; never shrink it after selection. */
  .gdp-custom-studio-core[data-step="1"] [data-preview-card] > :nth-child(2) {
    min-height: 440px !important;
  }

  .gdp-custom-studio-core[data-step="1"] [data-preview-card] > :nth-child(2) > div.absolute.inset-0.grid.place-items-center > div.relative {
    height: 84% !important;
    max-width: 84% !important;
    margin: auto !important;
  }

  .gdp-custom-studio-core [data-empty-pending="true"] {
    visibility: hidden !important;
  }

  /* Preserve the existing Customize editor layout without touching editor state. */
  .gdp-custom-studio-core[data-step="3"] [data-studio-row] {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-workspace] {
    display: none !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-aside] {
    grid-column: 1 !important;
    display: block !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-preview-card] {
    display: grid !important;
    grid-template-columns: minmax(360px, .70fr) minmax(620px, 1.30fr) !important;
    grid-template-rows: auto minmax(0, 1fr) !important;
    height: 100% !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-preview-card] > :first-child {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-preview-card] > :nth-child(2) {
    grid-column: 2 !important;
    grid-row: 2 !important;
    height: 100% !important;
    border-left: 1px solid #E5EAF0 !important;
  }

  .gdp-custom-studio-core[data-step="3"] [data-preview-card] > :nth-child(3) {
    grid-column: 1 !important;
    grid-row: 2 !important;
    min-height: 0 !important;
    height: 100% !important;
    overflow-y: auto !important;
    border-top: 0 !important;
    border-right: 1px solid #E5EAF0 !important;
    padding: 12px !important;
  }

  .gdp-custom-studio-core[data-step="5"] [data-aside] {
    gap: 10px !important;
  }

  .gdp-custom-studio-core[data-step="5"] [data-order-card] {
    display: block !important;
    flex: 0 0 auto !important;
    max-height: 180px !important;
    overflow: auto !important;
    margin: 0 !important;
    padding: 12px 14px !important;
    border-radius: 17px !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-core {
    --gdp-rail: 188px;
    --gdp-config: 438px;
    --gdp-gap: 12px;
  }

  .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :first-child {
    height: 108px !important;
    min-height: 108px !important;
  }
}

/* Unified desktop refinement layer */
.gdp-custom-studio-workspace {
  --gdp-guide-drawer-width: 420px;
  width: 100%;
  min-width: 0;
}
.gdp-custom-studio-content { min-width: 0; width: 100%; }

@media (min-width: ${DESKTOP_BREAKPOINT}px) {
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] #custom-studio-workspace {
    position: relative !important;
    z-index: 80 !important;
    isolation: isolate;
    pointer-events: auto !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] {
    position: relative !important;
    z-index: 81 !important;
    pointer-events: auto !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button {
    position: relative !important;
    z-index: 82 !important;
    pointer-events: auto !important;
    touch-action: manipulation !important;
  }

  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-studio-row] {
    grid-template-columns: minmax(0, 1fr) !important;
    grid-template-rows: minmax(0, 1fr) auto !important;
    gap: 10px !important;
    overflow: hidden !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-workspace] {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    height: 100% !important;
    max-height: none !important;
    overflow-x: clip !important;
    overflow-y: auto !important;
    padding: 18px 20px 22px !important;
    scroll-padding-bottom: 92px;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-aside],
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-actions] {
    display: none !important;
  }

  .gdp-step1-bottom-dock {
    grid-column: 1 !important;
    grid-row: 2 !important;
    position: sticky !important;
    bottom: 8px !important;
    z-index: 180 !important;
    display: grid;
    grid-template-columns: minmax(150px, .6fr) minmax(220px, 1fr) minmax(180px, .7fr);
    align-items: center;
    gap: 12px;
    min-height: 68px;
    border: 1px solid #D8E0E7;
    border-radius: 17px;
    background: rgba(255, 255, 255, .98);
    padding: 9px 11px;
    box-shadow: 0 16px 42px rgba(23, 50, 77, .12);
    backdrop-filter: blur(14px);
  }
  .gdp-step1-bottom-dock__button {
    display: inline-flex;
    min-height: 46px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 13px;
    padding: 10px 16px;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: .035em;
    text-transform: uppercase;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }
  .gdp-step1-bottom-dock__button:hover { transform: translateY(-1px); }
  .gdp-step1-bottom-dock__button--back { border: 1px solid #D5DEE6; background: #FFF; color: #17324D; }
  .gdp-step1-bottom-dock__button--back:hover { border-color: #9CAEBE; background: #F8FAFC; }
  .gdp-step1-bottom-dock__button--continue {
    border: 1px solid #17324D; background: #17324D; color: #FFF;
    box-shadow: 0 8px 18px rgba(23, 50, 77, .16);
  }
  .gdp-step1-bottom-dock__button--continue[data-ready="false"] {
    border-color: #A9B7C3; background: #617487; box-shadow: none;
  }
  .gdp-step1-bottom-dock__status { min-width: 0; text-align: center; }
  .gdp-step1-bottom-dock__eyebrow {
    color: #7A8996; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 9px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase;
  }
  .gdp-step1-bottom-dock__message {
    margin-top: 3px; overflow: hidden; color: #17324D; font-size: 11px;
    font-weight: 750; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap;
  }
  .gdp-step1-bottom-dock__message[data-error="true"] { color: #A45B19; }

  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    align-items: stretch !important;
    gap: 14px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button {
    min-height: 318px !important;
    overflow: hidden !important;
    border-color: #D8D1C7 !important;
    border-radius: 18px !important;
    background: #FFF !important;
    box-shadow: 0 8px 22px rgba(23, 50, 77, .045) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button:hover {
    border-color: #8095A8 !important;
    box-shadow: 0 14px 30px rgba(23, 50, 77, .09) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button.border-accent {
    border: 2px solid #17324D !important;
    background: #F8FAFC !important;
    box-shadow: 0 12px 28px rgba(23, 50, 77, .10) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :first-child {
    display: grid !important;
    width: 100% !important;
    height: 244px !important;
    min-height: 244px !important;
    place-items: center !important;
    overflow: hidden !important;
    border-bottom: 1px solid #E8E2D9;
    background: linear-gradient(145deg, #F4F1EB 0%, #ECE8E1 100%) !important;
    padding: 13px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :first-child img {
    display: block !important;
    width: auto !important;
    height: 94% !important;
    max-width: 94% !important;
    max-height: 94% !important;
    object-fit: contain !important;
    object-position: center center !important;
    transform: none !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button:hover > :first-child img {
    transform: scale(1.015) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :last-child { padding: 12px 13px !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :last-child .font-bold {
    color: #1B2A38 !important; font-size: 13px !important; line-height: 1.2 !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button.border-accent > :last-child .bg-accent {
    background: #17324D !important;
  }

  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] {
    grid-template-columns: minmax(0, 820px) !important;
    justify-content: center !important;
    justify-items: center !important;
    gap: 0 !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent {
    display: grid !important;
    grid-template-columns: minmax(260px, 310px) minmax(0, 1fr) !important;
    width: min(100%, 820px) !important;
    max-width: 820px !important;
    min-height: 278px !important;
    margin: 0 auto !important;
    border: 2px solid #17324D !important;
    border-radius: 20px !important;
    background: linear-gradient(135deg, #FFF 0%, #F7FAFC 100%) !important;
    box-shadow: 0 18px 42px rgba(23, 50, 77, .11) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child {
    width: 100% !important; height: 278px !important; min-height: 278px !important;
    border-right: 1px solid #E2E8EE !important; border-bottom: 0 !important;
    background: #EEF3F6 !important; padding: 18px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :first-child img {
    width: auto !important; height: 94% !important; max-width: 94% !important; max-height: 94% !important;
    object-fit: contain !important; object-position: center !important; transform: none !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent > :last-child {
    display: flex !important; min-width: 0 !important; flex-direction: column !important;
    justify-content: center !important; padding: 26px 28px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid][data-gdp-collapsed="true"] > button.border-accent::after {
    display: none !important; content: none !important;
  }
  .gdp-custom-studio-workspace [data-gdp-selected-summary] {
    margin-top: 13px !important; border-top: 1px solid #E0E7ED !important;
    padding-top: 12px !important; color: #52616F; font-size: 11px !important;
    font-weight: 700; line-height: 1.35;
  }

  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-color],
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-size-quantity],
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-group],
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-validation-message] {
    width: min(100%, 980px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-color] {
    margin-top: 18px !important; padding-top: 16px !important; border-top: 1px solid #EDF1F4;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-color] button {
    min-height: 38px !important; padding: 7px 10px !important; text-transform: capitalize;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-color] > div:first-child > span:last-child { display: none !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-size-quantity] {
    margin-top: 14px !important;
    grid-template-columns: minmax(0, 1fr) minmax(170px, .32fr) !important;
    gap: 16px !important; border: 1px solid #E4EAF0; border-radius: 17px !important;
    background: #FAFCFD; padding: 14px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-size] button.border-accent {
    border-color: #17324D !important; background: #17324D !important; color: #FFF !important;
    box-shadow: 0 5px 14px rgba(23, 50, 77, .14) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-quantity] > div {
    min-height: 40px !important; border-color: #CFD8E1 !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-group] { margin-top: 14px !important; padding-top: 14px !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-step1-group] > div:first-child { align-items: center !important; }
  .gdp-custom-studio-workspace[data-step1-validation="false"] [data-step1-validation-message] { display: none !important; }
  .gdp-custom-studio-workspace[data-step1-validation="true"] [data-step1-validation-message] { display: block !important; }

  .gdp-change-garment-button {
    position: absolute; top: 14px; right: 14px; z-index: 25;
    display: inline-flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px;
    border: 1px solid #C8D4DE; border-radius: 999px; background: rgba(255,255,255,.97);
    padding: 7px 11px; color: #17324D; box-shadow: 0 8px 20px rgba(23,50,77,.11);
    font-size: 9px; font-weight: 850; letter-spacing: .045em; text-transform: uppercase;
  }
  .gdp-change-garment-button:hover { background: #F7FAFC; border-color: #8FA3B5; }
  .gdp-change-garment-button:focus-visible { outline: 2px solid #17324D; outline-offset: 2px; }

  .gdp-step1-rail-tools { display: grid; gap: 7px; margin-top: 1px; }
  .gdp-step1-start-fresh {
    display: inline-flex; min-height: 40px; width: 100%; align-items: center; justify-content: flex-start; gap: 8px;
    border: 1px solid #DCE3EA; border-radius: 12px; background: #FFF; padding: 8px 10px;
    color: #566879; font-size: 9px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase;
  }
  .gdp-step1-start-fresh:hover { border-color: #AEBBC6; background: #F7F9FB; color: #17324D; }

  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-studio-rail] { z-index: 260 !important; overflow: visible !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] { position: relative !important; overflow: visible !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > button {
    min-height: 54px !important; width: 100% !important; max-width: 100% !important;
    align-items: center !important; gap: 8px !important; overflow: visible !important;
    border: 1px solid #D8E0E7 !important; border-radius: 13px !important; background: #FFF !important;
    padding: 9px 10px !important; color: #17324D !important; text-align: left !important;
    cursor: pointer !important; box-shadow: 0 8px 20px rgba(23, 50, 77, .055) !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > button:hover { border-color: #9CAEBE !important; background: #F8FAFC !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > button > span:first-child > span:last-child {
    display: block !important; margin-top: 2px !important; color: #667788 !important;
    font-size: 8.5px !important; font-weight: 650 !important; line-height: 1.3 !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > button > span:last-child { display: inline-flex !important; flex: 0 0 auto !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div {
    position: absolute !important; top: 0 !important; left: calc(100% + 12px) !important; z-index: 999 !important;
    width: var(--gdp-guide-drawer-width) !important; max-width: var(--gdp-guide-drawer-width) !important;
    max-height: calc(100dvh - 94px) !important; margin: 0 !important; overflow-x: hidden !important;
    overflow-y: auto !important; border: 1px solid #CDD8E1 !important; border-radius: 18px !important;
    background: #FFF !important; padding: 12px 12px 16px !important;
    box-shadow: 0 24px 64px rgba(23, 50, 77, .22) !important; pointer-events: auto !important;
    overscroll-behavior: contain; scrollbar-gutter: stable;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div > :first-child { padding-top: 28px !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div h2,
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div h3 { font-size: 13px !important; line-height: 1.3 !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div p,
  .gdp-custom-studio-workspace .gdp-custom-studio-core [data-guide] > div li { font-size: 11px !important; line-height: 1.5 !important; }

  .gdp-custom-studio-workspace[data-guide-open="true"] .gdp-custom-studio-core [data-studio-row] {
    width: calc(100% - var(--gdp-guide-drawer-width) - 16px) !important;
    transform: translateX(calc(var(--gdp-guide-drawer-width) + 16px)) !important;
    transition: width 180ms ease, transform 180ms ease;
  }
  .gdp-custom-studio-workspace[data-guide-open="false"] .gdp-custom-studio-core [data-studio-row] {
    transform: translateX(0); transition: width 180ms ease, transform 180ms ease;
  }
  .gdp-custom-guide-close {
    position: absolute; top: 10px; right: 10px; z-index: 1002; display: grid;
    width: 32px; height: 32px; place-items: center; border: 1px solid #D5DEE6;
    border-radius: 999px; background: #FFF; color: #17324D; font-size: 19px; line-height: 1;
    cursor: pointer; box-shadow: 0 6px 18px rgba(23, 50, 77, .10);
  }
  .gdp-custom-guide-close:hover { transform: scale(1.04); border-color: #9EAFBE; background: #F7FAFC; }
  .gdp-custom-guide-close:focus-visible { outline: 2px solid #17324D; outline-offset: 2px; }
  .gdp-custom-guide-backdrop {
    position: fixed; inset: 0; z-index: 245; border: 0; background: rgba(15, 23, 42, .10);
    padding: 0; cursor: default; backdrop-filter: blur(1px);
  }

  .gdp-custom-studio-workspace [aria-labelledby="saved-studio-draft-title"] { z-index: 1400 !important; }
  .gdp-custom-studio-workspace[data-modal-open="true"] .gdp-custom-studio-core [data-guide] > button {
    pointer-events: none !important; opacity: .48 !important;
  }

  .gdp-custom-studio-workspace [data-gdp-after-order-strip="true"] { display: none !important; }
  .gdp-guide-after-order {
    margin: 12px; border: 1px solid #DCE3EA; border-radius: 14px; background: #F7FAFC;
    padding: 12px; color: #17324D;
  }
  .gdp-guide-after-order__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; font-weight: 800;
    letter-spacing: .14em; text-transform: uppercase; color: #7A8996;
  }
  .gdp-guide-after-order__flow { margin-top: 7px; font-size: 10px; font-weight: 750; line-height: 1.5; }

  .gdp-lead-time-note, .gdp-dpi-status {
    margin-top: 8px; border-radius: 11px; padding: 9px 11px; font-size: 11px; line-height: 1.4;
  }
  .gdp-lead-time-note { background: #F5F8FA; color: #52616F; }
  .gdp-lead-time-note[data-invalid="true"] { background: #FFF7ED; color: #9A4D13; }
  .gdp-dpi-status { border: 1px solid #DCE3EA; background: #F7FAFC; color: #52616F; }
  .gdp-dpi-status[data-level="low"] { border-color: #F1C08C; background: #FFF7ED; color: #8C4B18; }
  .gdp-dpi-status[data-level="good"] { border-color: #C9DDD1; background: #F2F8F4; color: #285A3D; }

  .gdp-custom-studio-workspace[data-seasonal-active="true"] {
    display: grid; grid-template-columns: 204px minmax(0, 1fr); align-items: start; gap: 14px;
    width: 100%; max-width: 1920px; margin: 0 auto; padding: 10px 18px 14px;
    background: linear-gradient(180deg, #F4F7FA 0%, #EDF2F6 45%, #F8FAFC 100%);
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] > .gdp-seasonal-shell-rail {
    grid-column: 1; position: sticky; top: 66px; z-index: 50; display: flex;
    max-height: calc(100dvh - 82px); flex-direction: column; gap: 8px; overflow: auto;
    border: 1px solid #DCE3EA; border-radius: 18px; background: rgba(255,255,255,.98);
    padding: 9px; box-shadow: 0 14px 36px rgba(23,50,77,.08); scrollbar-width: thin;
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] > .gdp-custom-studio-content { grid-column: 2; min-width: 0; }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main {
    min-height: calc(100dvh - 82px) !important; padding: 0 !important; background: transparent !important;
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div { max-width: none !important; }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > header {
    margin-bottom: 8px !important; border-radius: 18px !important; padding: 10px 14px !important;
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > header h1 {
    margin-top: 2px !important; font-size: clamp(1.65rem, 2vw, 2.25rem) !important; line-height: 1 !important;
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > header p:not(.font-mono),
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > header .rounded-full { display: none !important; }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > .mb-6.grid.grid-cols-3 {
    margin-bottom: 9px !important; border-radius: 14px !important;
  }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] .gdp-custom-studio-core > main > div > .mb-6.grid.grid-cols-3 > div {
    padding-top: 7px !important; padding-bottom: 7px !important;
  }
  .gdp-seasonal-shell-rail__brand { padding: 8px 8px 10px; border-bottom: 1px solid #E7EDF2; }
  .gdp-seasonal-shell-rail__eyebrow {
    color: #A66331; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 8px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase;
  }
  .gdp-seasonal-shell-rail__title { margin-top: 4px; color: #17324D; font-size: 13px; font-weight: 900; }
  .gdp-seasonal-shell-step {
    display: flex; width: 100%; min-height: 43px; align-items: center; gap: 8px; border: 0;
    border-radius: 12px; padding: 8px 9px; background: transparent; color: #667788; text-align: left;
  }
  button.gdp-seasonal-shell-step:not(:disabled) { cursor: pointer; }
  button.gdp-seasonal-shell-step:not(:disabled):hover { background: #F4F7FA; color: #17324D; }
  .gdp-seasonal-shell-step[data-active="true"] { background: #17324D; color: #FFF; box-shadow: 0 8px 18px rgba(23,50,77,.14); }
  .gdp-seasonal-shell-step[data-complete="true"] { color: #17324D; }
  .gdp-seasonal-shell-step__number {
    display: grid; width: 23px; height: 23px; flex: 0 0 23px; place-items: center;
    border: 1px solid currentColor; border-radius: 999px; font-size: 9px; font-weight: 900; opacity: .88;
  }
  .gdp-seasonal-shell-step__label { font-size: 9px; font-weight: 850; line-height: 1.15; letter-spacing: .035em; text-transform: uppercase; }
  .gdp-seasonal-shell-rail__note { margin-top: 3px; border-radius: 12px; background: #F5F8FA; padding: 9px; color: #607080; font-size: 9.5px; line-height: 1.4; }
}

@media (min-width: 1600px) {
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) {
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important; gap: 11px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button { min-height: 258px !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button > :first-child {
    height: 188px !important; min-height: 188px !important; padding: 10px !important;
  }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid]:not([data-gdp-collapsed="true"]) > button > :first-child img {
    width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important;
    object-fit: contain !important; object-position: center !important;
  }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1599px) {
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button > :first-child { height: 224px !important; min-height: 224px !important; }
  .gdp-custom-studio-workspace .gdp-custom-studio-core[data-step="1"] [data-garment-grid] > button { min-height: 298px !important; }
}

@media (min-width: ${DESKTOP_BREAKPOINT}px) and (max-width: 1500px) {
  .gdp-custom-studio-workspace { --gdp-guide-drawer-width: 372px; }
  .gdp-custom-studio-workspace[data-seasonal-active="true"] { grid-template-columns: 188px minmax(0,1fr); gap: 12px; }
}
`;

const normalize = (value) => String(value || "").toLowerCase().replace(/grey/g, "gray").replace(/[^a-z0-9]+/g, " ").trim();
const isDesktop = () => typeof window !== "undefined" && window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
const isSelected = (card) => Boolean(card?.classList?.contains("border-accent"));

function isVisibleButton(node) {
  if (!(node instanceof HTMLButtonElement)) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 1 && rect.height > 1;
}
function garmentGrid(root) {
  const annotated = root?.querySelector("[data-garment-grid]");
  if (annotated) return annotated;
  const workspace = root?.querySelector("#custom-studio-workspace");
  const stepRoot = workspace?.firstElementChild;
  if (!stepRoot) return null;
  return Array.from(stepRoot.children || []).find((node) =>
    node instanceof HTMLElement && node.classList.contains("grid") &&
    Array.from(node.children || []).some((child) => child instanceof HTMLButtonElement && Boolean(child.querySelector(".font-bold.leading-tight")))
  ) || null;
}
function garmentCards(grid) {
  return Array.from(grid?.children || []).filter((node) => node instanceof HTMLButtonElement && Boolean(node.querySelector(".font-bold.leading-tight")));
}
function cardAtPoint(grid, clientX, clientY) {
  return garmentCards(grid).find((button) => {
    if (!isVisibleButton(button)) return false;
    const rect = button.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}
function cardImage(card) {
  const image = card?.querySelector?.(":scope > div:first-child img");
  return image instanceof HTMLImageElement ? image : null;
}
function rememberOriginalCardImage(card) {
  const image = cardImage(card);
  if (!image) return null;
  if (!image.dataset.gdpOriginalSrc) image.dataset.gdpOriginalSrc = image.getAttribute("src") || image.currentSrc || image.src || "";
  return image;
}
function restoreExpandedGarmentImages(grid) {
  if (!grid) return;
  const collapsed = grid.dataset.gdpCollapsed === "true";
  const selected = garmentCards(grid).find(isSelected) || null;
  garmentCards(grid).forEach((card) => {
    const image = rememberOriginalCardImage(card);
    if (!image || (collapsed && card === selected)) return;
    const original = image.dataset.gdpOriginalSrc || "";
    if (original && image.getAttribute("src") !== original) image.setAttribute("src", original);
  });
}
function syncGarmentChooserState(grid, resetExpanded = false) {
  if (!grid) return null;
  const selected = garmentCards(grid).find(isSelected) || null;
  if (!selected) {
    grid.removeAttribute("data-gdp-collapsed");
    grid.removeAttribute("data-gdp-user-expanded");
    return null;
  }
  if (resetExpanded) grid.dataset.gdpUserExpanded = "false";
  grid.dataset.gdpCollapsed = grid.dataset.gdpUserExpanded === "true" ? "false" : "true";
  return selected;
}
function exactLabel(root, text) {
  return Array.from(root?.querySelectorAll("label") || []).find((label) => String(label.textContent || "").trim() === text) || null;
}
function exactTextElement(root, selector, text) {
  return Array.from(root?.querySelectorAll(selector) || []).find((node) => String(node.textContent || "").trim() === text) || null;
}
function selectedSize(section) {
  const selected = Array.from(section?.querySelectorAll("button") || []).find((button) => button.classList.contains("border-accent"));
  return String(selected?.textContent || "").trim();
}
function selectedQuantity(section) {
  const value = Array.from(section?.querySelectorAll("span") || []).find((span) => span.classList.contains("font-mono"));
  return String(value?.textContent || "").trim();
}
function findButtonByText(root, text) {
  return Array.from(root?.querySelectorAll("button") || []).find((button) => String(button.textContent || "").trim().includes(text)) || null;
}
function desktopNav(shell) { return shell?.querySelector?.('[data-gdp-step-nav="desktop"]') || null; }
function navButtons(nav) { return Array.from(nav?.querySelectorAll("button") || []).filter((button) => button instanceof HTMLButtonElement); }
function selectedColor(section) {
  const selected = Array.from(section?.querySelectorAll("button") || []).find((button) => {
    const classes = String(button.className || "");
    return classes.includes("bg-[#17324D]") && classes.includes("text-white");
  });
  return String(selected?.textContent || "").trim();
}
function productForCard(catalog, card) {
  const name = String(card?.querySelector(".font-bold.leading-tight")?.textContent || "").trim();
  return name ? catalog.find((product) => normalize(product?.name) === normalize(name)) || null : null;
}
function colorMockup(product, color) {
  if (!product || !color) return "";
  const customization = product.customization || {};
  const mockups = customization?.preview?.colorMockups || {};
  const mockupKey = Object.keys(mockups).find((key) => normalize(key) === normalize(color));
  const configured = mockupKey ? mockups[mockupKey]?.frontUrl : "";
  if (configured) return configured;
  const mediaEntry = Object.entries(customization?.media || {}).find(([, meta]) => normalize(meta?.color) === normalize(color) && normalize(meta?.view || "front") === "front");
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
  return { widthIn: Number(override.widthIn || base.widthIn || base.maxWidthIn || 12), heightIn: Number(override.heightIn || base.heightIn || base.maxHeightIn || 14) };
}
function estimatedPhotoDpi(draft, catalog) {
  const photos = Array.isArray(draft?.photos) ? draft.photos.filter((photo) => Number(photo?.width) > 0 && Number(photo?.height) > 0) : [];
  if (!photos.length) return null;
  const product = catalog.find((entry) => String(entry?.id) === String(draft?.productId)) || null;
  if (!product) return null;
  const profile = printProfile(product, draft?.size, draft?.placement);
  if (!(profile.widthIn > 0 && profile.heightIn > 0)) return null;
  return Math.min(...photos.map((photo) => {
    const width = Number(photo.width); const height = Number(photo.height);
    return Math.floor(Math.max(Math.min(width / profile.widthIn, height / profile.heightIn), Math.min(width / profile.heightIn, height / profile.widthIn)));
  }));
}
function findAfterOrderStrip(host) {
  const labels = Array.from(host?.querySelectorAll("div,span,p") || []).filter((node) => normalize(node.textContent) === "after you order");
  for (const label of labels) {
    let node = label.parentElement;
    while (node && node !== host) {
      const text = normalize(node.textContent);
      if (text.includes("order received") && text.includes("payment confirmed") && (text.includes("pickup shipping") || text.includes("pickup") || text.includes("shipping"))) return node;
      node = node.parentElement;
    }
  }
  return null;
}

export default function CustomStudioDesktopWorkspace() {
  const hostRef = useRef(null);
  const { confirmAction } = useNotifications();
  const [catalog, setCatalog] = useState([]);
  const [settings, setSettings] = useState({ standardLeadDays: DEFAULT_STANDARD_LEAD_DAYS, rushLeadDays: DEFAULT_RUSH_LEAD_DAYS });
  const [seasonalActive, setSeasonalActive] = useState(false);
  const [stepOneActive, setStepOneActive] = useState(true);
  const [rowTarget, setRowTarget] = useState(null);
  const [railTarget, setRailTarget] = useState(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [navState, setNavState] = useState({ ready: false, hint: "Choose a garment, color and size to continue." });
  const [selectedCard, setSelectedCard] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guidePanel, setGuidePanel] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const selectedIdentityRef = useRef("");
  const guideButtonRef = useRef(null);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const host = hostRef.current;
    if (!host) return undefined;
    const desktop = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    let pendingPointer = null;
    let fallbackTimer = 0;
    const currentShell = () => host.querySelector(".gdp-custom-studio-core");
    const onPointerDown = (event) => {
      if (!desktop.matches || event.button !== 0) return;
      const shell = currentShell();
      if (!shell || shell.dataset.step !== "1") return;
      const grid = garmentGrid(shell);
      const card = cardAtPoint(grid, event.clientX, event.clientY);
      if (!card) return;
      pendingPointer = { pointerId: event.pointerId, card, grid, x: event.clientX, y: event.clientY, selectedBefore: isSelected(card), collapsedBefore: grid?.dataset?.gdpCollapsed === "true" };
    };
    const onPointerUp = (event) => {
      const pending = pendingPointer;
      pendingPointer = null;
      if (!pending || pending.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > MAX_POINTER_TRAVEL_PX) return;
      if (cardAtPoint(pending.grid, event.clientX, event.clientY) !== pending.card) return;
      window.clearTimeout(fallbackTimer);
      fallbackTimer = window.setTimeout(() => {
        const shell = currentShell();
        if (!shell || shell.dataset.step !== "1" || !pending.card.isConnected) return;
        if (!pending.selectedBefore && !isSelected(pending.card)) {
          pending.card.click();
          return;
        }
        if (pending.selectedBefore && pending.collapsedBefore && pending.grid.isConnected && pending.grid.dataset.gdpCollapsed === "true") {
          pending.grid.dataset.gdpUserExpanded = "true";
          pending.grid.dataset.gdpCollapsed = "false";
        }
      }, FALLBACK_DELAY_MS);
    };
    const clearPending = () => { pendingPointer = null; };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", clearPending, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", clearPending, true);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const refine = useCallback(() => {
    const host = hostRef.current;
    if (!host || !isDesktop()) return;
    const shell = host.querySelector(".gdp-custom-studio-core");
    if (!shell) return;

    const guide = shell.querySelector("[data-guide]");
    const guideButton = guide?.querySelector(":scope > button") || null;
    const panel = guide?.querySelector(":scope > div") || null;
    if (guide && guideButton instanceof HTMLButtonElement && guide.dataset.gdpDesktopInitialized !== "true") {
      guide.dataset.gdpDesktopInitialized = "true";
      if (guideButton.getAttribute("aria-expanded") === "true") guideButton.click();
    }
    const draftModal = host.querySelector('[aria-labelledby="saved-studio-draft-title"]');
    const nextModalOpen = Boolean(draftModal);
    const nextGuideOpen = Boolean(guideButton && guideButton.getAttribute("aria-expanded") === "true" && panel);
    if (nextModalOpen && nextGuideOpen && guideButton instanceof HTMLButtonElement) guideButton.click();
    guideButtonRef.current = guideButton instanceof HTMLButtonElement ? guideButton : null;
    setGuideOpen(nextModalOpen ? false : nextGuideOpen);
    setGuidePanel(panel);
    setModalOpen(nextModalOpen);

    const afterOrder = findAfterOrderStrip(host);
    afterOrder?.setAttribute("data-gdp-after-order-strip", "true");

    const seasonalHeading = Array.from(shell.querySelectorAll("h1") || []).find((heading) => String(heading.textContent || "").trim() === "SEASONAL DESIGN LAB");
    const nextSeasonal = Boolean(seasonalHeading);
    host.dataset.seasonalActive = nextSeasonal ? "true" : "false";
    setSeasonalActive(nextSeasonal);
    if (nextSeasonal) {
      if (host.dataset.seasonalFitApplied !== "true") {
        const zoomText = Array.from(shell.querySelectorAll("span")).find((span) => String(span.textContent || "").trim() === "118%");
        const fitButton = Array.from(shell.querySelectorAll("button")).find((button) => String(button.textContent || "").trim() === "Fit");
        if (zoomText && fitButton instanceof HTMLButtonElement) {
          host.dataset.seasonalFitApplied = "true";
          fitButton.click();
        }
      }
    } else {
      delete host.dataset.seasonalFitApplied;
    }

    const activeStepOne = shell.dataset.step === "1";
    setStepOneActive(activeStepOne);
    setRowTarget(activeStepOne ? shell.querySelector("[data-studio-row]") : null);
    setRailTarget(activeStepOne ? shell.querySelector("[data-studio-rail]") : null);

    if (activeStepOne) {
      const workspace = shell.querySelector("[data-workspace]") || shell.querySelector("#custom-studio-workspace");
      const colorLabel = exactLabel(workspace, "Color");
      const sizeLabel = exactLabel(workspace, "Size");
      const quantityLabel = exactLabel(workspace, "Quantity");
      const colorSection = colorLabel?.parentElement?.parentElement || null;
      const sizeSection = sizeLabel?.parentElement || null;
      const quantitySection = quantityLabel?.parentElement || null;
      const sizeQuantityRow = sizeSection?.parentElement || null;
      colorSection?.setAttribute("data-step1-color", "true");
      sizeSection?.setAttribute("data-step1-size", "true");
      quantitySection?.setAttribute("data-step1-quantity", "true");
      if (sizeQuantityRow && quantitySection?.parentElement === sizeQuantityRow) sizeQuantityRow.setAttribute("data-step1-size-quantity", "true");

      const validation = exactTextElement(workspace, "div", STEP_ONE_VALIDATION);
      validation?.setAttribute("data-step1-validation-message", "true");

      const grid = garmentGrid(shell);
      const currentSelected = garmentCards(grid).find(isSelected) || null;
      const identity = String(currentSelected?.querySelector(".font-bold")?.textContent || "").trim();
      const selectionChanged = Boolean(identity && identity !== selectedIdentityRef.current);
      if (identity !== selectedIdentityRef.current) {
        selectedIdentityRef.current = identity;
        setValidationVisible(false);
      }
      const selected = syncGarmentChooserState(grid, selectionChanged);
      restoreExpandedGarmentImages(grid);

      if (selected) {
        const colorValue = String(colorLabel?.parentElement?.querySelector("span")?.textContent || "").trim();
        const sizeValue = selectedSize(sizeSection);
        const quantityValue = selectedQuantity(quantitySection);
        const body = selected.lastElementChild;
        if (body) {
          let summary = body.querySelector("[data-gdp-selected-summary]");
          if (!summary) {
            summary = document.createElement("div");
            summary.setAttribute("data-gdp-selected-summary", "true");
            body.appendChild(summary);
          }
          const nextText = [colorValue, sizeValue || "Choose size", quantityValue ? `Qty ${quantityValue}` : ""].filter(Boolean).join(" · ");
          if (summary.textContent !== nextText) summary.textContent = nextText;
        }
      }

      const color = selectedColor(colorSection);
      const product = productForCard(catalog, selected);
      const exactUrl = colorMockup(product, color);
      if (selected && exactUrl) {
        if (grid?.dataset.gdpCollapsed === "true") {
          const image = cardImage(selected);
          if (image && image.getAttribute("src") !== exactUrl) {
            image.setAttribute("src", exactUrl);
            image.dataset.gdpExactColor = color;
          }
        }
        const preview = shell.querySelector('[data-preview-card] img[alt*="front mockup"]');
        if (preview instanceof HTMLImageElement && preview.getAttribute("src") !== exactUrl) preview.setAttribute("src", exactUrl);
      }

      Array.from(sizeSection?.querySelectorAll("button:disabled") || []).forEach((button) => {
        if (!color) return;
        button.title = `Unavailable in ${color}`;
        button.setAttribute("aria-label", `${String(button.textContent || "").trim()} unavailable in ${color}`);
      });

      setSelectedCard(selected);
      const nav = desktopNav(shell);
      const buttons = navButtons(nav);
      const primary = buttons.at(-1) || null;
      const hint = String(nav?.querySelector("p")?.textContent || "").trim();
      const ready = Boolean(primary && !primary.disabled);
      setNavState({ ready, hint: hint || "Choose a garment, color and size to continue." });
    } else {
      setSelectedCard(null);
    }

    if (shell.dataset.step === "4") {
      const workspace = shell.querySelector("[data-workspace]") || shell;
      const dateInput = workspace.querySelector('input[type="date"]');
      const rushButton = Array.from(workspace.querySelectorAll("button")).find((button) => normalize(button.textContent).startsWith("rush"));
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
            node.textContent = String(node.textContent).replace("To change it, I must create a new design before checkout.", "Editing this design from the cart reopens it and requires approval again before checkout.");
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
  }, [catalog, settings.rushLeadDays, settings.standardLeadDays]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof MutationObserver === "undefined") return undefined;
    let frame = 0;
    let stopped = false;
    const schedule = () => {
      if (stopped || frame) return;
      frame = window.requestAnimationFrame(() => { frame = 0; refine(); });
    };
    refine();
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: ["class", "src", "aria-expanded", "data-step", "data-gdp-collapsed", "value", "disabled"],
    });
    document.addEventListener("change", schedule, true);
    document.addEventListener("click", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      stopped = true;
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

  const closeGuide = useCallback((restoreFocus = true) => {
    const button = guideButtonRef.current;
    if (button && button.getAttribute("aria-expanded") === "true") {
      button.click();
      if (restoreFocus) window.requestAnimationFrame(() => button.focus({ preventScroll: true }));
    }
  }, []);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") closeGuide(true); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeGuide, guideOpen]);

  const originalButtons = () => {
    const shell = hostRef.current?.querySelector(".gdp-custom-studio-core");
    return navButtons(desktopNav(shell));
  };
  const handleBack = () => { originalButtons()[0]?.click(); };
  const handleContinue = () => {
    const buttons = originalButtons();
    const primary = buttons.at(-1);
    if (!(primary instanceof HTMLButtonElement)) return;
    if (primary.disabled) {
      setValidationVisible(true);
      const shell = hostRef.current?.querySelector(".gdp-custom-studio-core");
      const workspace = shell?.querySelector("[data-workspace]") || shell?.querySelector("#custom-studio-workspace");
      const sizeLabel = exactTextElement(workspace, "label", "Size");
      const target = sizeLabel?.parentElement || workspace;
      target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target?.animate?.([
        { boxShadow: "0 0 0 0 rgba(23,50,77,0)" },
        { boxShadow: "0 0 0 4px rgba(23,50,77,.16)" },
        { boxShadow: "0 0 0 0 rgba(23,50,77,0)" },
      ], { duration: 760, easing: "ease-out" });
      return;
    }
    setValidationVisible(false);
    primary.click();
  };
  const handleStartFresh = async () => {
    const confirmed = await confirmAction({
      eyebrow: "GDP Custom Studio",
      title: "Start a new design?",
      description: "This clears the current Custom Studio draft, garment, colors, sizes, artwork, photos, personalization and approval choices, then returns to Step 1. Your account and unrelated cart items are not affected.",
      confirmLabel: "Start fresh",
      cancelLabel: "Keep current design",
      tone: "warning",
    });
    if (!confirmed) return;
    clearStudioEditIntent();
    try { window.localStorage.removeItem(STUDIO_DRAFT_KEY); } catch { /* page reset still clears live state */ }
    window.location.replace("/custom-studio");
  };
  const expandGarments = () => {
    const grid = selectedCard?.closest?.("[data-garment-grid]");
    if (!grid) return;
    grid.dataset.gdpUserExpanded = "true";
    grid.dataset.gdpCollapsed = "false";
    window.requestAnimationFrame(() => {
      const first = grid.querySelector("button");
      if (first instanceof HTMLButtonElement) first.focus({ preventScroll: true });
    });
  };
  const leaveSeasonalForStep = (targetStep) => {
    const host = hostRef.current;
    const shell = host?.querySelector(".gdp-custom-studio-core");
    const backButton = findButtonByText(shell, "Design options");
    if (!(backButton instanceof HTMLButtonElement)) return;
    backButton.click();
    if (targetStep !== 2) return;
    let attempts = 0;
    const advance = () => {
      attempts += 1;
      const continueButton = findButtonByText(host, "Continue to Choose Design");
      if (continueButton instanceof HTMLButtonElement && !continueButton.disabled) return continueButton.click();
      if (attempts < 18) window.setTimeout(advance, 25);
    };
    window.requestAnimationFrame(advance);
  };

  const statusMessage = validationVisible && !navState.ready
    ? navState.hint
    : navState.ready
      ? "Garment setup complete · ready to choose your design"
      : "Choose your garment, color and size";

  return (
    <div
      ref={hostRef}
      className="gdp-custom-studio-workspace"
      data-guide-open={guideOpen ? "true" : "false"}
      data-modal-open={modalOpen ? "true" : "false"}
      data-seasonal-active={seasonalActive ? "true" : "false"}
      data-step1-validation={validationVisible ? "true" : "false"}
    >
      <style>{styles}</style>

      {seasonalActive && (
        <aside className="gdp-seasonal-shell-rail" aria-label="Custom Studio steps">
          <div className="gdp-seasonal-shell-rail__brand">
            <div className="gdp-seasonal-shell-rail__eyebrow">GDP Custom Studio</div>
            <div className="gdp-seasonal-shell-rail__title">Seasonal Design</div>
          </div>
          {STUDIO_STEPS.map((label, index) => {
            const step = index + 1;
            const active = step === 3;
            const complete = step < 3;
            const enabled = step < 3;
            return (
              <button key={label} type="button" className="gdp-seasonal-shell-step" data-active={active ? "true" : "false"} data-complete={complete ? "true" : "false"} disabled={!enabled} aria-current={active ? "step" : undefined} onClick={() => enabled && leaveSeasonalForStep(step)}>
                <span className="gdp-seasonal-shell-step__number">{complete ? "✓" : step}</span>
                <span className="gdp-seasonal-shell-step__label">{label}</span>
              </button>
            );
          })}
          <div className="gdp-seasonal-shell-rail__note"><strong>Customize is active.</strong><br />Browse artwork, edit layers and review inside this workspace. Use Garment or Choose Design above to go back without losing the selected blank.</div>
        </aside>
      )}

      <div className="gdp-custom-studio-content"><CustomStudio /></div>

      {stepOneActive && railTarget && createPortal(
        <div className="gdp-step1-rail-tools">
          <button type="button" className="gdp-step1-start-fresh" onClick={handleStartFresh}><RotateCcw size={14} aria-hidden="true" /> Start fresh</button>
        </div>, railTarget
      )}

      {stepOneActive && rowTarget && createPortal(
        <div className="gdp-step1-bottom-dock" aria-label="Step 1 navigation">
          <button type="button" className="gdp-step1-bottom-dock__button gdp-step1-bottom-dock__button--back" onClick={handleBack}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
          <div className="gdp-step1-bottom-dock__status" aria-live="polite">
            <div className="gdp-step1-bottom-dock__eyebrow">Step 1 of 5 · Garment</div>
            <div className="gdp-step1-bottom-dock__message" data-error={validationVisible && !navState.ready ? "true" : "false"}>{statusMessage}</div>
          </div>
          <button type="button" className="gdp-step1-bottom-dock__button gdp-step1-bottom-dock__button--continue" data-ready={navState.ready ? "true" : "false"} aria-disabled={!navState.ready} onClick={handleContinue}>Continue <ArrowRight size={16} aria-hidden="true" /></button>
        </div>, rowTarget
      )}

      {selectedCard && typeof document !== "undefined" && createPortal(
        <button type="button" className="gdp-change-garment-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); expandGarments(); }} aria-label="Change garment"><RotateCcw size={12} /> Change garment</button>, selectedCard
      )}

      {guideOpen && typeof document !== "undefined" && createPortal(
        <button type="button" className="gdp-custom-guide-backdrop" aria-label="Close How Custom Orders Work" onClick={() => closeGuide(true)} />, document.body
      )}
      {guideOpen && guidePanel && createPortal(
        <button type="button" className="gdp-custom-guide-close" aria-label="Close How Custom Orders Work" title="Close" onClick={() => closeGuide(true)}>×</button>, guidePanel
      )}
      {guideOpen && guidePanel && createPortal(
        <div className="gdp-guide-after-order" aria-label="After you order">
          <div className="gdp-guide-after-order__eyebrow">After you order</div>
          <div className="gdp-guide-after-order__flow">Order received → Payment confirmed → Approved file locked → Printing → Quality check → Pickup / shipping</div>
        </div>, guidePanel
      )}
    </div>
  );
}
