import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 anchor, found ${count}`);
  return source.replace(before, after);
}

const editorPath = "src/components/storefront/MemorialTypographyEditor.jsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = replaceOnce(
  editor,
  'export function MemorialTypographyPreview({ personalization = {}, tone = "light" }) {',
  'export function MemorialTypographyPreview({ personalization, tone = "light" }) {',
  "preview personalization inference"
);
fs.writeFileSync(editorPath, editor);

const studioPath = "src/pages/CustomStudio.jsx";
let studio = fs.readFileSync(studioPath, "utf8");
studio = replaceOnce(
  studio,
  '  const [personalization, setPersonalization] = useState({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" });',
  '  const [personalization, setPersonalization] = useState(/** @type {any} */ ({ name: "", nickname: "", dates: "", number: "", quote: "", message: "", instructions: "" }));',
  "personalization state type"
);

const oldPreview = `              {hasPreviewText && (
                <div
                  className={"absolute z-30 grid content-center px-2 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,.75)] " + (textZone?.tone === "dark" ? "text-[#26211d]" : "text-white")}
                  style={textZoneStyle}
                >
                  {personalization?.memorialTypography ? (
                    <MemorialTypographyPreview personalization={personalization} tone={textZone?.tone || "light"} />
                  ) : (
                    <div className={textZone?.align === "left" ? "text-left" : textZone?.align === "right" ? "text-right" : "text-center"}>
                      {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
                      {personalization?.nickname && <div className="text-[7px] font-bold uppercase tracking-wider mt-0.5">{personalization.nickname}</div>}
                      {(personalization?.dates || personalization?.number) && <div className="font-mono text-[6px] mt-0.5">{[personalization.dates, personalization.number].filter(Boolean).join(" · ")}</div>}
                      {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
                      {personalization?.message && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.message}</div>}
                    </div>
                  )}
                </div>
              )}`;

const newPreview = `              {hasPreviewText && (personalization?.memorialTypography ? (
                <div className="absolute inset-0 z-30 pointer-events-none">
                  <MemorialTypographyPreview personalization={personalization} tone={textZone?.tone || "light"} />
                </div>
              ) : (
                <div
                  className={"absolute z-30 grid content-center px-2 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,.75)] " + (textZone?.tone === "dark" ? "text-[#26211d]" : "text-white")}
                  style={textZoneStyle}
                >
                  <div className={textZone?.align === "left" ? "text-left" : textZone?.align === "right" ? "text-right" : "text-center"}>
                    {personalization?.name && <div className="font-display text-sm leading-none uppercase tracking-wide">{personalization.name}</div>}
                    {personalization?.nickname && <div className="text-[7px] font-bold uppercase tracking-wider mt-0.5">{personalization.nickname}</div>}
                    {(personalization?.dates || personalization?.number) && <div className="font-mono text-[6px] mt-0.5">{[personalization.dates, personalization.number].filter(Boolean).join(" · ")}</div>}
                    {personalization?.quote && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.quote}</div>}
                    {personalization?.message && <div className="text-[6px] leading-tight mt-0.5 line-clamp-2">{personalization.message}</div>}
                  </div>
                </div>
              ))}`;

studio = replaceOnce(studio, oldPreview, newPreview, "full print-area Memorial preview");
fs.writeFileSync(studioPath, studio);

console.log("Applied Memorial typography corrections.");
