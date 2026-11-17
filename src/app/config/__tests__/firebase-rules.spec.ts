import * as fs from 'fs';
import * as path from 'path';
import { ADMIN_EMAILS, AdminConfig } from '../admin.config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const generator = require('../../../../scripts/generate-firebase-rules.js') as {
  WRITABLE_DB_NODES: string[];
  buildDatabaseRules(emails: string[]): { rules: Record<string, unknown> };
  buildStorageRules(emails: string[]): string;
  loadAdminEmails(): string[];
};

const ROOT = path.join(__dirname, '../../../..');
const SRC_APP = path.join(ROOT, 'src', 'app');
const normalize = (s: string) => s.replace(/\r\n/g, '\n');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('Firebase security rules', () => {
  it('committed database.rules.json matches the generator output', () => {
    const expected = JSON.stringify(generator.buildDatabaseRules(generator.loadAdminEmails()), null, 2) + '\n';
    const actual = normalize(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
    expect(actual).toBe(expected);
  });

  it('committed storage.rules matches the generator output', () => {
    const expected = generator.buildStorageRules(generator.loadAdminEmails());
    const actual = normalize(fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'));
    expect(actual).toBe(expected);
  });

  it('uses the same admin emails as AdminConfig', () => {
    expect(generator.loadAdminEmails()).toEqual(ADMIN_EMAILS.map(e => e.toLowerCase()));
    expect(AdminConfig.isAdminEmail(ADMIN_EMAILS[0])).toBe(true);
    expect(AdminConfig.isAdminEmail('stranger@example.com')).toBe(false);
  });

  it('is public-read and admin-only write for every node', () => {
    const { rules } = generator.buildDatabaseRules(generator.loadAdminEmails());
    expect(rules['.read']).toBe(true);
    expect(rules['.write']).toBeUndefined();
    for (const node of generator.WRITABLE_DB_NODES) {
      const write = (rules[node] as Record<string, string>)['.write'];
      expect(write).toContain('auth != null');
      expect(write).not.toMatch(/\|\|\s*true|==\s*null/);
    }
  });

  it('covers every top-level database node the application references', () => {
    const refPattern = /\bref\([^,()]*(?:\(\))?,\s*[`'"]([A-Za-z]\w*)/g;
    const used = new Set<string>();
    for (const file of sourceFiles(SRC_APP)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(refPattern)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter(node => !generator.WRITABLE_DB_NODES.includes(node));
    expect(missing).toEqual([]);
  });
});
