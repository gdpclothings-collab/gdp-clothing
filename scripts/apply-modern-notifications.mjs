import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  return source.replace(before, after);
}

function patchCustomStudio() {
  const path = "src/pages/CustomStudio.jsx";
  let source = fs.readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    'import { useCart } from "@/lib/CartContext";\n',
    'import { useCart } from "@/lib/CartContext";\nimport { useNotifications } from "@/lib/NotificationContext";\n',
    "CustomStudio notification import"
  );

  source = replaceOnce(
    source,
    '  const { addItem } = useCart();\n',
    '  const { addItem } = useCart();\n  const { confirmAction } = useNotifications();\n',
    "CustomStudio notification hook"
  );

  source = replaceOnce(
    source,
    `  const chooseNoTemplate = () => {\n    if (activeStyleTemplate && typeof window !== "undefined" && !window.confirm("Switch to a blank design? Your uploaded photos and text will be preserved. The GDP template will be removed.")) return;\n    const side = previewSide;\n    setDesignStylesBySide((current) => ({ ...current, [side]: NO_TEMPLATE_STYLE }));\n    setDesignMood("Original");\n    setArtworkStates((current) => ({ ...current, [side]: defaultArtworkState() }));\n  };`,
    `  const chooseNoTemplate = async () => {\n    if (activeStyleTemplate) {\n      const confirmed = await confirmAction({\n        tone: "warning",\n        title: "Switch to a blank design?",\n        description: "Your uploaded photos and text will be preserved. The GDP template will be removed from this fabric.",\n        confirmLabel: "Switch to blank",\n        cancelLabel: "Keep design",\n      });\n      if (!confirmed) return;\n    }\n    const side = previewSide;\n    setDesignStylesBySide((current) => ({ ...current, [side]: NO_TEMPLATE_STYLE }));\n    setDesignMood("Original");\n    setArtworkStates((current) => ({ ...current, [side]: defaultArtworkState() }));\n  };`,
    "CustomStudio blank-template confirm"
  );

  source = replaceOnce(
    source,
    '  const deleteActivePhoto = () => {\n',
    '  const deleteActivePhoto = async () => {\n',
    "CustomStudio delete-photo async"
  );

  source = replaceOnce(
    source,
    `    if (designPath === "bootleg" && photo && typeof window !== "undefined") {\n      const photoId = String(photo.id || "");\n      const usedSides = ["front", "back"].filter((side) => (editorLayersBySide[side] || []).some((layer) => layer.type === "photo" && String(layer.photoId || "") === photoId));\n      const usedMessage = usedSides.length ? \` It is currently placed on \${usedSides.join(" and ")}.\` : "";\n      const label = String(photo.name || "this uploaded photo");\n      const confirmed = window.confirm(\`Delete "\${label}" from this custom project?\${usedMessage} This removes every editable instance of the photo from both fabrics. Protected GDP template artwork will stay.\`);\n      if (!confirmed) return;\n    }`,
    `    if (designPath === "bootleg" && photo) {\n      const photoId = String(photo.id || "");\n      const usedSides = ["front", "back"].filter((side) => (editorLayersBySide[side] || []).some((layer) => layer.type === "photo" && String(layer.photoId || "") === photoId));\n      const usedMessage = usedSides.length ? \`It is currently placed on \${usedSides.join(" and ")}. \` : "";\n      const label = String(photo.name || "this uploaded photo");\n      const confirmed = await confirmAction({\n        tone: "destructive",\n        title: \`Delete “\${label}”?\`,\n        description: \`\${usedMessage}This removes every editable instance of the photo from both fabrics. Protected GDP template artwork will stay.\`,\n        confirmLabel: "Delete photo",\n        cancelLabel: "Keep photo",\n      });\n      if (!confirmed) return;\n    }`,
    "CustomStudio delete-photo confirm"
  );

  fs.writeFileSync(path, source);
}

function patchDtfGangSheet() {
  const path = "src/pages/DTFGangSheet.jsx";
  let source = fs.readFileSync(path, "utf8");

  source = replaceOnce(
    source,
    'import { useAuth } from "@/lib/AuthContext";\n',
    'import { useAuth } from "@/lib/AuthContext";\nimport { useNotifications } from "@/lib/NotificationContext";\n',
    "DTF notification import"
  );

  source = replaceOnce(
    source,
    '  const { addItem, replaceItem } = useCart();\n',
    '  const { addItem, replaceItem } = useCart();\n  const { confirmAction } = useNotifications();\n',
    "DTF notification hook"
  );

  source = replaceOnce(
    source,
    '  const resetWorkspace = () => {\n',
    '  const resetWorkspace = async () => {\n',
    "DTF reset async"
  );

  source = replaceOnce(
    source,
    `    if (\n      hasWorkspaceChanges &&\n      typeof window !== "undefined" &&\n      !window.confirm("Reset this DTF workspace? All uploaded artwork and layout changes will be cleared.")\n    ) {\n      return;\n    }`,
    `    if (hasWorkspaceChanges) {\n      const confirmed = await confirmAction({\n        tone: "destructive",\n        title: "Reset DTF workspace?",\n        description: "All uploaded artwork, placement, sizing, and layout changes in this workspace will be cleared.",\n        confirmLabel: "Reset workspace",\n        cancelLabel: "Keep editing",\n      });\n      if (!confirmed) return;\n    }`,
    "DTF reset confirm"
  );

  fs.writeFileSync(path, source);
}

patchCustomStudio();
patchDtfGangSheet();

const remaining = [];
for (const path of ["src/pages/CustomStudio.jsx", "src/pages/DTFGangSheet.jsx", "src/lib/UnsavedChangesContext.jsx"]) {
  const source = fs.readFileSync(path, "utf8");
  if (/window\.(?:alert|confirm)\s*\(/.test(source)) remaining.push(path);
}

if (remaining.length) {
  throw new Error(`Legacy browser dialogs remain in: ${remaining.join(", ")}`);
}

console.log("Modern notification migration applied successfully.");
