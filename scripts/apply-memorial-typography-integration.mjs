import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  }
  return source.replace(before, after);
}

const studioPath = "src/pages/CustomStudio.jsx";
let studio = fs.readFileSync(studioPath, "utf8");

studio = replaceOnce(
  studio,
  'import SeasonalStudio from "@/components/storefront/SeasonalStudio";\n',
  'import SeasonalStudio from "@/components/storefront/SeasonalStudio";\nimport { MemorialTypographyEditor, MemorialTypographyPreview } from "@/components/storefront/MemorialTypographyEditor";\n',
  "Memorial typography import"
);

const memorialVerificationAnchor = `              <label className={"mt-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm " + (memorialNameConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-[#E1D9CF] bg-white text-[#4F4942]")}>
                <input
                  type="checkbox"
                  checked={memorialNameConfirmed}
                  disabled={!String(personalization.name || "").trim()}
                  onChange={(event) => setMemorialNameConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                <span><strong>I verified the memorial name is spelled exactly as it should be printed.</strong> Changing the name will require verification again.</span>
              </label>
`;

studio = replaceOnce(
  studio,
  memorialVerificationAnchor,
  `${memorialVerificationAnchor}              <MemorialTypographyEditor
                value={personalization.memorialTypography}
                onChange={(memorialTypography) => setPersonalization((current) => ({ ...current, memorialTypography }))}
              />
`,
  "Memorial text style editor placement"
);

const legacyPreview = `                  <div className={textZone?.align === "left" ? "text-left" : textZone?.align === "right" ? "text-right" : "text-center"}>
                    {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
                    {personalization?.nickname && <div className="text-[7px] font-bold uppercase tracking-wider mt-0.5">{personalization.nickname}</div>}
                    {(personalization?.dates || personalization?.number) && <div className="font-mono text-[6px] mt-0.5">{[personalization.dates, personalization.number].filter(Boolean).join(" · ")}</div>}
                    {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
                    {personalization?.message && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.message}</div>}
                  </div>
`;

studio = replaceOnce(
  studio,
  legacyPreview,
  `                  {personalization?.memorialTypography ? (
                    <MemorialTypographyPreview personalization={personalization} tone={textZone?.tone || "light"} />
                  ) : (
${legacyPreview.replaceAll("                  ", "                    ").trimEnd()}
                  )}
`,
  "Memorial live preview renderer"
);

fs.writeFileSync(studioPath, studio);

const editorPath = "src/components/storefront/MemorialTypographyEditor.jsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = replaceOnce(
  editor,
  'import React, { useEffect, useMemo, useState } from "react";',
  'import React, { useEffect, useId, useMemo, useState } from "react";',
  "Unique SVG id hook"
);
editor = replaceOnce(
  editor,
  '  const pathId = `memorial-${fieldKey}-${String(field.shape || "straight").replace(/[^a-z-]/g, "")}`;\n',
  '  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");\n  const pathId = `memorial-${fieldKey}-${reactId}-${String(field.shape || "straight").replace(/[^a-z-]/g, "")}`;\n',
  "Unique curved text path id"
);
fs.writeFileSync(editorPath, editor);

const verifyPath = "scripts/verify-memorial-tribute.mjs";
let verify = fs.readFileSync(verifyPath, "utf8");
const verifyAnchor = 'const studio = read("src/pages/CustomStudio.jsx");\n';
const checks = `const memorialTypography = read("src/components/storefront/MemorialTypographyEditor.jsx");
for (const required of [
  "Memorial text & style",
  "Timeless Serif",
  "Heavenly Script",
  "Modern Tribute",
  "Classic Arch",
  "Legacy Bold",
  "Soft Remembrance",
  "arch-up",
  "arch-down",
  "Curve amount",
  "Auto-fit long text to the safe area",
  "keepRecommendedPlacement",
  "memorialTypography",
]) {
  if (!memorialTypography.includes(required)) fail(\`Memorial typography editor is missing required behavior: \${required}\`);
}

`;
verify = replaceOnce(verify, verifyAnchor, `${checks}${verifyAnchor}`, "Memorial typography regression checks");
fs.writeFileSync(verifyPath, verify);

console.log("Applied Memorial typography editor integration.");
