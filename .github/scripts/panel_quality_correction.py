from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

advanced_path = Path("src/components/storefront/CustomStudioAdvancedEditor.jsx")
advanced = advanced_path.read_text()

old_tabs = '''  const panelTabs = [
    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),
    ["photos", ImageIcon, designPath === "upload" ? "Artwork" : "Photos"],
    ...(tools.text ? [["lettering", Type, "Lettering"]] : []),
    ...(designPath === "memorial" ? [["details", Heart, "Details"]] : []),
    ["layers", Layers, "Layers"],
  ];'''
new_tabs = '''  const panelTabs = /** @type {Array<[string, React.ComponentType<any>, string]>} */ ([
    ...(designPath !== "upload" ? [["design", Palette, "Design"]] : []),
    ["photos", ImageIcon, designPath === "upload" ? "Artwork" : "Photos"],
    ...(tools.text ? [["lettering", Type, "Lettering"]] : []),
    ...(designPath === "memorial" ? [["details", Heart, "Details"]] : []),
    ["layers", Layers, "Layers"],
  ]);'''
advanced = replace_once(advanced, old_tabs, new_tabs, "panel tab typing")

old_design_end = '''        </div>
      </div>
      {moodOptions?.length > 0 && <div id="custom-studio-color-finish" className="scroll-mt-28 border-t border-white/10 pt-3">'''
new_design_end = '''        </div>
        {(designPath === "bootleg" || designPath === "memorial") && <div className="mt-3 rounded-xl border border-white/[.08] bg-white/[.035] p-2.5 text-[9px] leading-relaxed text-white/48"><strong className="text-white/80">{designPath === "memorial" ? "Memorial front design:" : "Front template:"}</strong> {designStyle === blankStyleName ? "Blank canvas selected. Only customer-added photos, lettering and stickers will print." : "The selected GDP artwork is protected. The back stays blank until you add a separate back design."}</div>}
      </div>
      {moodOptions?.length > 0 && <div id="custom-studio-color-finish" className="scroll-mt-28 border-t border-white/10 pt-3">'''
advanced = replace_once(advanced, old_design_end, new_design_end, "design helper guidance")

memorial_anchor = '''  const renderMemorialDetails = () => (
    <div id="custom-studio-memorial-details" className="scroll-mt-28 space-y-3">'''
memorial_new = '''  const memorialPersonalization = /** @type {{ name?: string, dates?: string, message?: string }} */ (personalization || {});

  const renderMemorialDetails = () => (
    <div id="custom-studio-memorial-details" className="scroll-mt-28 space-y-3">'''
advanced = replace_once(advanced, memorial_anchor, memorial_new, "memorial personalization typing")
advanced = advanced.replace('personalization?.name || ""', 'memorialPersonalization.name || ""')
advanced = advanced.replace('personalization?.dates || ""', 'memorialPersonalization.dates || ""')
advanced = advanced.replace('personalization?.message || ""', 'memorialPersonalization.message || ""')

advanced_path.write_text(advanced)

page_path = Path("src/pages/CustomStudio.jsx")
page = page_path.read_text()

page = replace_once(
    page,
    '{(designPath === "bootleg" || designPath === "memorial") && <div className="mt-3 rounded-xl border border-[#DCE3EA] bg-white px-3 py-2 text-xs text-[#52616F]">',
    '{(designPath === "bootleg" || designPath === "memorial") && <div className="hidden">',
    "hide external front helper",
)
page = replace_once(
    page,
    '{(designPath === "bootleg" || designPath === "memorial") && activeStyleTemplate && <div className="mt-6 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] px-4 py-3 text-sm text-[#52616F]">',
    '{(designPath === "bootleg" || designPath === "memorial") && activeStyleTemplate && <div className="hidden">',
    "hide external protected helper",
)
page = replace_once(
    page,
    '{(designPath === "bootleg" || designPath === "memorial") && designStyle === NO_TEMPLATE_STYLE && <div className="mt-6 rounded-xl border border-[#DCE3EA] bg-[#F8FAFC] px-4 py-3 text-sm text-[#52616F]">',
    '{(designPath === "bootleg" || designPath === "memorial") && designStyle === NO_TEMPLATE_STYLE && <div className="hidden">',
    "hide external blank helper",
)

page_path.write_text(page)
