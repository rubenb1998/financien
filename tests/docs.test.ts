import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pageNames } from '../src/domain/pages.ts';

test('each sidebar route has a Markdown guide', () => {
  const index = new URL('../docs/systeem.md', import.meta.url);
  const guide = readFileSync(index, 'utf8');
  for (const route of Object.keys(pageNames)) {
    const row = guide.split('\n').find(line => line.includes('| `#' + route + '` |'));
    const link = row?.match(/\]\((paginas\/[^)]+\.md)\)/)?.[1];
    assert.ok(link, 'Missing guide for #' + route);
    const page = new URL(link, index);
    const contents = readFileSync(page, 'utf8');
    assert.ok(contents.includes('`#' + route + '`'), 'Route missing from ' + link);
  }
});

test('all project guides link to existing files and Markdown headings', () => {
  const root = new URL('../', import.meta.url);
  const guides = [...readdirSync(root), ...readdirSync(new URL('docs/', root), { recursive: true }).map(file => 'docs/' + file)]
    .filter(file => file.endsWith('.md'));
  for (const guide of guides) {
    const page = new URL(guide, root);
    for (const [, target] of readFileSync(page, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const link = new URL(target, page);
      assert.ok(existsSync(fileURLToPath(link)), 'Missing link ' + target + ' in ' + guide);
      if (!link.hash || !link.pathname.endsWith('.md')) continue;
      const headings = [...readFileSync(link, 'utf8').matchAll(/^#{1,6} (.+)$/gm)]
        .map(([, title]) => title.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replaceAll(' ', '-'));
      assert.ok(headings.includes(decodeURIComponent(link.hash.slice(1))), 'Missing heading ' + target + ' in ' + guide);
    }
  }
});
