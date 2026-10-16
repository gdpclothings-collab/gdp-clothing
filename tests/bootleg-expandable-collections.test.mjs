import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd();
const catalogue = readFileSync(resolve(root, 'src/lib/customStudioStyleTemplates.js'), 'utf8');
const editor = readFileSync(resolve(root, 'src/components/storefront/custom-studio-v2/ProtectedTemplateEditorV2.jsx'), 'utf8');
const admin = readFileSync(resolve(root, 'src/pages/TemplateManager.jsx'), 'utf8');
for (const collection of ['chrome-galaxy', 'cosmic-storm']) {
  test(`${collection}: five variants and production files`, () => {
    const occurrences = [...catalogue.matchAll(new RegExp(`id: "${collection}-[a-z-]+"`, 'g'))];
    assert.equal(occurrences.length, 5);
    for (const match of occurrences) {
      const id = match[0].split('"')[1];
      assert.ok(existsSync(resolve(root, `public/images/gdp-styles/${id}.png`)), `${id} missing`);
    }
  });
}
test('bootleg editor has expandable collections and admin names', () => {
  assert.ok(editor.includes('data-gdp-bootleg-collections="expandable"'));
  assert.ok(editor.includes('aria-expanded={expanded}'));
  assert.ok(admin.includes('updateBootlegCollectionName'));
});
test('memorial templates remain configured', () => {
  assert.ok(catalogue.includes('id: "memorial-eternal-light"'));
});