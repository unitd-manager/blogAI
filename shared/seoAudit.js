// Shared SEO keyword audit, used by the browser (live score) and the server (auto-optimize after writing),
// so both always agree on the score.
export function keywordAudit(content = '', title = '', primary = '', related = []) {
  const body = String(content || '').split(/^## Sources\b/im)[0];
  const plain = body.replace(/\[[^\]]+\]\([^)]*\)/g, ' ').replace(/[#*_`>\[\]()]/g, ' ').toLowerCase();
  const words = plain.match(/[a-z0-9]+/g) || [];
  const phraseCount = (phrase) => {
    const p = String(phrase || '').toLowerCase().match(/[a-z0-9]+/g) || [];
    if (!p.length) return 0;
    let n = 0;
    for (let i = 0; i <= words.length - p.length; i++) {
      if (p.every((w, j) => words[i + j] === w)) n++;
    }
    return n;
  };
  const primaryWords = String(primary || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  const intro = primaryWords.length > 0 && words.slice(0, 100).join(' ').includes(primaryWords.join(' '));
  const h1 = body.match(/^#\s+(.+)$/m)?.[1] || title;
  const titleHas = String(h1).toLowerCase().includes(String(primary || '').toLowerCase());
  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].toLowerCase());
  const headingHas = headings.some((h) => h.includes(String(primary || '').toLowerCase()));
  const count = phraseCount(primary);

  const relatedTerms = (related || []).map((t) => (typeof t === 'object' && t?.keyword ? t.keyword : String(t)));
  const relatedUsed = relatedTerms.filter((term) => phraseCount(term) > 0);
  const relatedMissing = relatedTerms.filter((term) => phraseCount(term) === 0);

  let score = 0;
  if (titleHas) score += 25;
  if (intro) score += 20;
  if (headingHas) score += 20;
  if (count >= 2 && count <= 8) score += 15;
  else if (count === 1) score += 8;
  else if (count > 8) score += 10;
  if (relatedTerms.length > 0) {
    score += Math.round((relatedUsed.length / relatedTerms.length) * 12);
  } else {
    score += 10;
  }
  if (words.length >= 350) score += 8;
  else if (words.length >= 200) score += 4;

  let grade = 'Needs Work';
  let gradeColor = '#9a3434';
  if (score >= 80) { grade = 'Client Deliverable Ready ⭐'; gradeColor = '#2e9b64'; }
  else if (score >= 60) { grade = 'Good Potential'; gradeColor = '#6852cb'; }

  return {
    count,
    intro,
    title: titleHas,
    heading: headingHas,
    score: Math.min(score, 100),
    grade,
    gradeColor,
    wordCount: words.length,
    relatedUsed,
    relatedMissing
  };
}
