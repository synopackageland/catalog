import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stringify } from 'yaml';
const checker = resolve('scripts/check-community.mjs');
const publisher = { schema: 1, display_name: 'Example', contact_email: 'app@example.com', support_email: 'help@example.com', github_owner_id: 1234567, maintainers: [1234567] };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'community-check-'));
  mkdirSync(join(root, 'community/alice'), { recursive: true });
  for (const [name, data] of Object.entries({ 'catalog.yaml': { schema: 3, publishers: {}, packages: [] }, 'moderation.yaml': { schema: 1 }, 'reserved-names.yaml': { schema: 1 }, 'community/alice/publisher.yaml': publisher })) writeFileSync(join(root, name), stringify(data));
  return root;
}
const pkg = { schema: 1, package: 'C1234567XApp', version: '1.0-1', displayname: 'App', source: { repo: 'alice/app', release: 'v1' }, assets: [{ name: 'app.spk', arch: ['x86_64'], sha256: 'a'.repeat(64), size: 2048 }] };
const run = root => spawnSync(process.execPath, [checker, '--catalog-dir', root], { encoding: 'utf8' });
test('public command accepts valid alphanumeric IDs and rejects old dotted or foreign prefixes', () => {
  for (const id of ['C1234567XApp', 'alice.App', 'C2XApp']) {
    const root = fixture();
    try {
      writeFileSync(join(root, `community/alice/${id}.yaml`), stringify({ ...pkg, package: id }));
      const result = run(root);
      assert.equal(result.status, id === pkg.package ? 0 : 1, result.stderr);
    } finally { rmSync(root, { recursive: true }); }
  }
});
test('public command rejects case-insensitive catalog reservations', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, `community/alice/${pkg.package}.yaml`), stringify(pkg));
    writeFileSync(join(root, 'catalog.yaml'), stringify({ schema: 3, packages: [], publishers: { alice: { display_name: 'Example', contact_email: 'app@example.com', support_email: 'help@example.com', package_names: [pkg.package.toLowerCase()] } } }));
    assert.equal(run(root).status, 1);
  } finally { rmSync(root, { recursive: true }); }
});
test('public command rejects IDs differing only in app-name case', { skip: process.platform === 'darwin' && 'requires case-sensitive file names' }, () => {
  const root = fixture();
  try {
    for (const name of ['App', 'APP']) {
      const id = `C1234567X${name}`;
      writeFileSync(join(root, `community/alice/${id}.yaml`), stringify({ ...pkg, package: id }));
    }
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /already used/);
  } finally { rmSync(root, { recursive: true }); }
});
test('public command fails closed for unknown fields and missing catalog control files', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, `community/alice/${pkg.package}.yaml`), stringify({ ...pkg, trust: 'official' }));
    assert.equal(run(root).status, 1);
    rmSync(join(root, 'moderation.yaml'));
    assert.equal(run(root).status, 1);
  } finally { rmSync(root, { recursive: true }); }
});
