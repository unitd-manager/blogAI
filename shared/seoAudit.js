// Shared SEO keyword audit, used by the browser (live score) and the server (auto-optimize after writing),
// so both always agree on the score.

// Lowercased word tokens in any language ("AI–powered" -> ["ai", "powered"]).
// Every check compares whole-word token sequences, so the keyword "ai" never matches inside "said".
export function tokenize(text) {
  return String(text || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) || [];
}

function countPhrase(tokens, phrase) {
  if (!phrase.length) return 0;
  let n = 0;
  for (let i = 0; i <= tokens.length - phrase.length; i++) {
    if (phrase.every((w, j) => tokens[i + j] === w)) n++;
  }
  return n;
}

export function keywordAudit(content = '', title = '', primary = '', related = []) {
  const body = String(content || '').split(/^## Sources\b/im)[0];
  const plain = body.replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ').replace(/[#*_`>]/g, ' ');
  const words = tokenize(plain);
  const primaryWords = tokenize(primary);
  const hasPrimary = primaryWords.length > 0;

  const h1 = body.match(/^#\s+(.+)$/m)?.[1] || title;
  const headings = [...body.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => tokenize(m[1]));
  // Intro = first 100 words of the body, not counting the H1 line.
  const introWords = tokenize(body.replace(/^#\s+.+$/m, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, ' $1 ')).slice(0, 100);

  const titleHas = hasPrimary && countPhrase(tokenize(h1), primaryWords) > 0;
  const intro = hasPrimary && countPhrase(introWords, primaryWords) > 0;
  const headingHas = hasPrimary && headings.some((h) => countPhrase(h, primaryWords) > 0);
  const count = countPhrase(words, primaryWords);

  const relatedTerms = (related || []).map((t) => (typeof t === 'object' && t?.keyword ? t.keyword : String(t))).filter((t) => tokenize(t).length);
  const relatedUsed = relatedTerms.filter((term) => countPhrase(words, tokenize(term)) > 0);
  const relatedMissing = relatedTerms.filter((term) => countPhrase(words, tokenize(term)) === 0);

  let score = 0;
  if (hasPrimary) {
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
    hasPrimary,
    score: Math.min(score, 100),
    grade,
    gradeColor,
    wordCount: words.length,
    relatedUsed,
    relatedMissing
  };
}
