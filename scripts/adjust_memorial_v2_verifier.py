from pathlib import Path

path = Path('scripts/verify-photo-bootleg-desktop.mjs')
text = path.read_text()
replacements = {
    "assert(protectedV2.includes('data-gdp-bootleg-active-layer=\"true\"'), 'Bootleg exposes explicit active-layer selection');":
        "assert(protectedV2.includes(\"data-gdp-bootleg-active-layer={isBootleg ? 'true' : undefined}\"), 'Bootleg exposes explicit active-layer selection without leaking its marker into Memorial');",
    "assert(protectedV2.includes('data-gdp-bootleg-linked-photo-zone=\"true\"'), 'photo zone is linked to the editable template transform');":
        "assert(protectedV2.includes(\"data-gdp-bootleg-linked-photo-zone={isBootleg ? 'true' : undefined}\"), 'Bootleg photo zone remains linked without applying Bootleg foreground stacking to Memorial');",
    "assert(protectedV2.includes('data-gdp-bootleg-active-status=\"true\"'), 'active layer gets a persistent visible editing label');":
        "assert(protectedV2.includes(\"data-gdp-bootleg-active-status={isBootleg ? 'true' : undefined}\"), 'Bootleg active-layer status remains explicitly scoped');",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'expected one verifier contract to update, found {count}: {old[:60]}')
    text = text.replace(old, new, 1)
path.write_text(text)
print('Adjusted Bootleg verifier markers for safe Memorial parity.')
