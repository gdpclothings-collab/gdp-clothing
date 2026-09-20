from pathlib import Path

TARGET = Path("src/pages/CustomStudio.jsx")
source = TARGET.read_text(encoding="utf-8")

old_warning = '''  const editorOutsideWarning = selectedEditorLayer
    ? (
        Number(selectedEditorLayer.x || 50) < 7 ||
        Number(selectedEditorLayer.x || 50) > 93 ||
        Number(selectedEditorLayer.y || 50) < 7 ||
        Number(selectedEditorLayer.y || 50) > 93 ||
        (selectedEditorLayer.type === "photo" && Number(selectedEditorLayer.size || 62) > 135)
          ? "Part of your design is outside the printable area. Reposition or resize it before approval."
          : ""
      )
    : (
        previewArtworkPhoto && (Math.abs(Number(artworkOffset.x || 0)) > 34 || Math.abs(Number(artworkOffset.y || 0)) > 34 || artworkScale > 132)
          ? "Part of your design may be outside the printable area. Reposition or resize it before approval."
          : ""
      );
'''

new_warning = '''  const editorLayerOutsideSafeArea = (layer) => {
    if (!layer || layer.visible === false) return false;
    const x = Number(layer.x ?? 50);
    const y = Number(layer.y ?? 50);
    return (
      x < 7 ||
      x > 93 ||
      y < 7 ||
      y > 93 ||
      (layer.type === "photo" && Number(layer.size ?? 62) > 135)
    );
  };
  const printedEditorSides = placement === "front_back"
    ? ["front", "back"]
    : [placement === "back" ? "back" : "front"];
  const unsafeEditorSide = printedEditorSides.find((side) =>
    (editorLayersBySide[side] || []).some(editorLayerOutsideSafeArea)
  ) || "";
  const unsafeLegacyArtworkSide = printedEditorSides.find((side) => {
    const state = artworkStates[side] || defaultArtworkState(styleTemplateForSide(side));
    const offset = state.offset || { x: 0, y: 0 };
    return Boolean(artworkPhotoForSide(side)) && (
      Math.abs(Number(offset.x || 0)) > 34 ||
      Math.abs(Number(offset.y || 0)) > 34 ||
      Number(state.scale ?? 92) > 132
    );
  }) || "";
  const unsafePrintSide = unsafeEditorSide || unsafeLegacyArtworkSide;
  const hasUnsafeEditorContent = Boolean(unsafePrintSide);
  const editorOutsideWarning = hasUnsafeEditorContent
    ? unsafePrintSide !== previewSide
      ? `Part of your ${unsafePrintSide} design is outside the printable area. Switch to the ${unsafePrintSide} side and reposition or resize it before approval.`
      : "Part of your design is outside the printable area. Reposition or resize it before approval."
    : "";
'''

old_continue = '''    if (step === 3) {
      return Boolean(orderDesignStyle) && photos.length >= minPhotos && memorialDetailsReady;
    }
'''
new_continue = '''    if (step === 3) {
      return Boolean(orderDesignStyle) && photos.length >= minPhotos && memorialDetailsReady && !hasUnsafeEditorContent;
    }
'''

old_hint = '''      if (designPath === "memorial" && !String(personalization.name || "").trim()) return "Enter the memorial name exactly as it should be printed.";
      if (designPath === "memorial" && !memorialNameConfirmed) return "Verify the memorial name spelling to continue.";
'''
new_hint = '''      if (designPath === "memorial" && !String(personalization.name || "").trim()) return "Enter the memorial name exactly as it should be printed.";
      if (designPath === "memorial" && !memorialNameConfirmed) return "Verify the memorial name spelling to continue.";
      if (hasUnsafeEditorContent) {
        return unsafePrintSide && unsafePrintSide !== previewSide
          ? `Move or resize the ${unsafePrintSide} design inside the printable area to continue.`
          : "Move or resize every design element inside the printable area to continue.";
      }
'''

old_final_guard = '''    if (designPath === "memorial" && !memorialDetailsReady) {
      setWarn("Enter the memorial name and verify its spelling before approval.");
      return;
    }

    setSaving(true);
'''
new_final_guard = '''    if (designPath === "memorial" && !memorialDetailsReady) {
      setWarn("Enter the memorial name and verify its spelling before approval.");
      return;
    }
    if (hasUnsafeEditorContent) {
      setWarn("Move or resize every design element inside the printable area before approval.");
      setPreviewSide(unsafePrintSide || previewSide);
      setStep(3);
      return;
    }

    setSaving(true);
'''

replacements = [
    (old_warning, new_warning, "full-design print-area validation"),
    (old_continue, new_continue, "Customize continue gate"),
    (old_hint, new_hint, "Customize boundary hint"),
    (old_final_guard, new_final_guard, "final approval defense-in-depth guard"),
]

for old, new, label in replacements:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label} anchor, found {count}.")
    source = source.replace(old, new, 1)

TARGET.write_text(source, encoding="utf-8")
print("Applied scoped Custom Studio safe-boundary repair.")
