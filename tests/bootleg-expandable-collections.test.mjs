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
      assert.ok(existsSync(resolve(root, `public/images/gdp-styles/${id}.webp`)), `${id} missing`);
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
test('original bootleg templates remain visible', () => {
  for (const id of ['flame-ice','flame-neon','flame-heatwave','flame-inferno','flame-toxic']) assert.ok(catalogue.includes(`id: "${id}"`));
  assert.ok(editor.includes("'original-bootleg'"));
});

test('Chrome Galaxy is the featured first and expanded default for new Bootleg sessions', () => {
  const chrome = editor.indexOf("{ id: 'chrome-galaxy', name:");
  const original = editor.indexOf("{ id: 'original-bootleg', name:");
  const cosmic = editor.indexOf("{ id: 'cosmic-storm', name:");
  assert.ok(chrome >= 0 && original > chrome && cosmic > original, 'Chrome Galaxy must be the first collection');
  assert.ok(editor.includes(": 'chrome-galaxy';"), 'new customers see Chrome Galaxy expanded');
  assert.ok(editor.includes("previouslySelected.collection || 'original-bootleg'"), 'existing design selection stays visible');
  assert.ok(editor.includes('onClick={() => selectTemplate(item)}'), 'choosing a specific asset remains manual');
});
