import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordAudit, tokenize } from '../shared/seoAudit.js';
import { isPrivateAddress, stripUnsupportedClaims } from '../server/research.js';

test('tokenize works for any language and splits on punctuation', () => {
  assert.deepEqual(tokenize('AI–powered SEO!'), ['ai', 'powered', 'seo']);
  assert.deepEqual(tokenize('தமிழ் வலைப்பதிவு'), ['தமிழ்', 'வலைப்பதிவு']);
  assert.deepEqual(tokenize(''), []);
});

test('SEO audit: keyword must match whole words, not inside other words', () => {
  const r = keywordAudit('# Title\n\nHe said it was fine.', 'Title', 'ai');
  assert.equal(r.count, 0);
});

test('SEO audit: well-optimized article scores 80+', () => {
  const body = 'social media calendar '.repeat(3) + 'word '.repeat(400);
  const content = `# How to Build a Social Media Calendar\n\nA social media calendar keeps posts on track. ${body}\n\n## Social Media Calendar Basics\n\nPlan ahead with a content plan.`;
  const r = keywordAudit(content, '', 'social media calendar', ['content plan']);
  assert.ok(r.title && r.intro && r.heading, JSON.stringify(r));
  assert.ok(r.score >= 80, `score ${r.score}`);
  assert.match(r.grade, /Client Deliverable Ready/);
});

test('SEO audit: empty keyword or empty article scores low, never crashes', () => {
  assert.ok(keywordAudit('# T\n\nsome text', 'T', '').score < 20);
  assert.equal(keywordAudit('', '', 'seo').score, 0);
  assert.equal(keywordAudit(undefined, undefined, undefined).score, 0);
});

test('SEO audit: the Sources section is not counted', () => {
  const r = keywordAudit('# Hello\n\nintro\n\n## Sources\n\nseo seo seo seo', 'Hello', 'seo');
  assert.equal(r.count, 0);
});

test('private address check blocks internal networks and allows public ones', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '100.64.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '104.16.0.1', '2606:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('topic titles: made-up percentage claims are removed, normal titles kept', () => {
  assert.doesNotMatch(stripUnsupportedClaims('How AI Cuts Claims Time by 40%'), /%/);
  assert.equal(stripUnsupportedClaims('How to Schedule Instagram Reels'), 'How to Schedule Instagram Reels');
  assert.match(stripUnsupportedClaims('Save $500 a Year on Tools'), /\$500/);
});
