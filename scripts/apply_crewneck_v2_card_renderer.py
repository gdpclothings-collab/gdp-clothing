from pathlib import Path

page_path = Path("src/pages/CustomStudioV2.jsx")
verify_path = Path("scripts/verify-custom-studio-v2.mjs")

page = page_path.read_text()
old_image = "<img src={item.images?.[0] || '/images/gdp-logo.webp'} alt={item.name}"
new_image = "<img src={item?.customization?.preview?.cardImageUrl || item?.customization?.cardImageUrl || item.images?.[0] || '/images/gdp-logo.webp'} alt={item.name}"

if page.count(old_image) != 1:
    raise SystemExit(f"Expected exactly one V2 garment-card image expression, found {page.count(old_image)}")
page = page.replace(old_image, new_image, 1)
page_path.write_text(page)

verify = verify_path.read_text()
anchor = "assert(page.includes('aria-pressed={selected}'), 'garment selection state must be exposed accessibly');\n"
check = "assert(page.includes(\"item?.customization?.preview?.cardImageUrl || item?.customization?.cardImageUrl || item.images?.[0]\"), 'garment gallery must prioritize the configured Studio card image before product photography');\n"

if check not in verify:
    if verify.count(anchor) != 1:
        raise SystemExit(f"Expected exactly one V2 garment-card verification anchor, found {verify.count(anchor)}")
    verify = verify.replace(anchor, anchor + check, 1)
    verify_path.write_text(verify)

print("Applied Custom Studio V2 garment-card image priority fix")
