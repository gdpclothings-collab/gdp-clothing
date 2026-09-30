import fs from "node:fs";

const file = "src/components/admin/ProductsModule.jsx";
let source = fs.readFileSync(file, "utf8");

const before = `                        <button
                          type="button"
                          onClick={() => setEditor({ mode: "edit", product })}
                          className="flex items-center gap-3 text-left"
                        >
                          <div className="w-11 h-11 rounded-lg bg-[#f2f2f2] border border-[#e5e5e5] overflow-hidden grid place-items-center shrink-0">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={17} className="text-[#aaa]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold max-w-[300px] truncate">{product.name}</div>
                            <div className="text-[11px] text-[#808080] mt-0.5">/{product.slug}</div>
                            {product.customDesignable && (
                              <span className="inline-flex mt-1 rounded-full bg-violet-100 text-violet-700 text-[9px] font-semibold px-2 py-0.5">
                                CUSTOM STUDIO
                              </span>
                            )}
                          </div>
                        </button>`;

const after = `                        <a
                          href={\`/products/\${product.slug}\`}
                          onClick={(event) => {
                            // Preserve the existing in-admin editor on a normal click while
                            // leaving the element as a real link for right-click, middle-click,
                            // Ctrl/Cmd-click and browser "Open link in new tab/window" actions.
                            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                              event.preventDefault();
                              setEditor({ mode: "edit", product });
                            }
                          }}
                          className="flex items-center gap-3 text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-black/15"
                          title="Open product; right-click for new tab or window"
                        >
                          <div className="w-11 h-11 rounded-lg bg-[#f2f2f2] border border-[#e5e5e5] overflow-hidden grid place-items-center shrink-0">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={17} className="text-[#aaa]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold max-w-[300px] truncate hover:underline">{product.name}</div>
                            <div className="text-[11px] text-[#808080] mt-0.5">/{product.slug}</div>
                            {product.customDesignable && (
                              <span className="inline-flex mt-1 rounded-full bg-violet-100 text-violet-700 text-[9px] font-semibold px-2 py-0.5">
                                CUSTOM STUDIO
                              </span>
                            )}
                          </div>
                        </a>`;

if (!source.includes(before)) {
  if (source.includes('title="Open product; right-click for new tab or window"')) {
    console.log("Admin product native-link patch already applied.");
    process.exit(0);
  }
  throw new Error("Expected product-row button block was not found; refusing unsafe patch.");
}

source = source.replace(before, after);
fs.writeFileSync(file, source);
console.log("Applied native product link behavior to admin product rows.");
