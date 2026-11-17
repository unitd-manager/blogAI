import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const Icon = ({ name, size = 18 }) => {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.3 1-1.3 2.2-1.6-.6a8 8 0 0 1-1.4.8l-.3 1.7h-2.6l-.3-1.7a8 8 0 0 1-1.4-.8l-1.6.6L7 16.1l1.3-1a8 8 0 0 1 0-1.7l-1.3-1 1.3-2.2 1.6.6a8 8 0 0 1 1.4-.8l.3-1.7h2.6l.3 1.7a8 8 0 0 1 1.4.8l1.6-.6 1.3 2.2-1.3 1a8 8 0 0 1-.1 1.6Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2Z"/><path d="m19 14 1.2 2.5L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.5Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    chev: <path d="m9 18 6-6-6-6"/>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    printer: <><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    copy: <><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    desktop: <><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></>,
    mobile: <><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></>,
    calendar: <><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></>,
    share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></>,
    code: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    x: <path d="M18 6 6 18M6 6l12 12"/>
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
};

function keywordAudit(content = '', title = '', primary = '', related = []) {
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

function markdownToHtml(md = '') {
  return String(md)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>')
    .replace(/^(.+)$/, '<p>$1</p>');
}

function highlightKeywords(text = '', keyword = '') {
  if (!keyword || !text) return text;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? <mark key={i}>{part}</mark> : part
  );
}

function generateRepurposed(art, siteUrl = '') {
  if (!art) return { linkedin: '', twitterText: '', newsletter: { subject: '', body: '' } };
  const domain = (() => { try { return new URL(siteUrl).hostname; } catch { return 'our website'; } })();
  const targetUrl = siteUrl || '#';
  const hook = `Most businesses struggle with ${art.keyword || 'growth'} because they focus on output instead of conversion outcomes.\n\nHere are 3 actionable lessons on ${art.title?.toLowerCase() || 'this topic'}:`;
  const takeaways = [
    '👉 Audit your current operational bottlenecks before scaling.',
    '👉 Use evidence-backed frameworks that match true search intent.',
    '👉 Include a direct, helpful next step to turn readers into qualified leads.'
  ];
  const linkedin = `${hook}\n\n${takeaways.join('\n\n')}\n\n💡 The key takeaway? Solve the reader's real challenge first, and conversions naturally follow.\n\nRead the full strategic guide on ${domain}: ${targetUrl}\n\n#ContentMarketing #SEO #LeadGeneration #B2BGrowth #${String(art.keyword || 'Business').replace(/[^a-zA-Z]/g, '')}`;

  const tweets = [
    `1/5 🧵 How to master ${art.keyword || art.title}:\n\nMost teams overcomplicate the process. Here is a practical framework you can implement today 👇`,
    '2/5 🎯 Step 1: Clarify the core bottleneck before investing in complex tools.',
    '3/5 ⚡ Step 2: Implement evidence-backed best practices that solve real search intent.',
    '4/5 📈 Step 3: Connect metrics to revenue. Traffic without conversion is vanity.',
    `5/5 🚀 Want the complete breakdown and step-by-step checklist?\n\nRead our full in-depth guide on ${domain}: ${targetUrl}`
  ];

  const newsletterSubject = `Quick insight: The smarter way to tackle ${art.keyword || art.title}`;
  const newsletterBody = `Hi there,\n\nIf you've been evaluating how to improve your results with ${art.keyword || art.title}, you're not alone.\n\nIn our latest in-depth breakdown, we analyzed:\n• Why standard approaches fall short and what to do instead\n• A step-by-step implementation roadmap\n• How to turn reader attention into measurable inquiries\n\n👉 Click below to read the complete article:\n[Read the Full Guide: ${art.title}](${targetUrl})\n\nBest regards,\nThe Team at ${domain}`;

  return { linkedin, twitterText: tweets.join('\n\n---\n\n'), newsletter: { subject: newsletterSubject, body: newsletterBody } };
}

function generateFaqJsonLd(art) {
  const qaList = [
    { q: `What is the primary benefit of ${art?.title || 'this strategy'}?`, a: 'Implementing proven frameworks around this topic delivers measurable results while streamlining team operations and search visibility.' },
    { q: 'How quickly can a business see measurable results?', a: 'Most teams observe positive shifts in organic engagement and conversion within 4 to 8 weeks of consistent execution.' },
    { q: 'What is the recommended starting step?', a: 'Audit your current baseline, identify friction points, and consult with our specialists for a customized implementation plan.' }
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qaList.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a }
    }))
  };
  return { qaList, scriptTag: `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>` };
}

function App() {
  const [tab, setTab] = useState('Overview');
  const [url, setUrl] = useState('');
  const [existingBlogs, setExistingBlogs] = useState('');
  const [topics, setTopics] = useState([]);
  const [researchInfo, setResearchInfo] = useState({ provider: '', searchWarning: '', summary: '', audience: '', sources: [], internalLinks: [] });
  const [selected, setSelected] = useState([]);
  const [analyzed, setAnalyzed] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [writingError, setWritingError] = useState('');
  const [busy, setBusy] = useState(false);
  const [article, setArticle] = useState(null);
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [setup, setSetup] = useState(false);

  // New Client Value Suite states
  const [seoSubtab, setSeoSubtab] = useState('strategy'); // 'strategy' | 'serp' | 'social' | 'faq' | 'evidence'
  const [serpDevice, setSerpDevice] = useState('desktop');
  const [showReportModal, setShowReportModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ active: false, current: 0, total: 0, currentTopic: '', completed: [] });
  const [topicViewMode, setTopicViewMode] = useState('list'); // 'list' | 'calendar'

  useEffect(() => {
    fetch('/api/articles').then((r) => (r.ok ? r.json() : [])).then((x) => Array.isArray(x) && setArticles(x)).catch(() => {});
    fetch('/api/health').then((r) => r.json()).then((x) => setSetup(!(x.aiReady ?? x.aiConfigured))).catch(() => setSetup(true));
  }, []);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(''), 2800); };
  const seo = article ? keywordAudit(article.content, article.title, article.keyword, article.relatedKeywords || []) : null;

  async function analyze() {
    if (!url.trim()) { setAnalysisError('Add your website URL first.'); return; }
    setAnalysisError('');
    setBusy(true);
    try {
      const r = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, existingBlogs }), signal: AbortSignal.timeout(300000) });
      const raw = await r.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if (!r.ok) throw Error(data.error || `Website analysis failed (HTTP ${r.status}).`);
      if (!raw) throw Error('The local analysis server returned an empty response.');
      setTopics(data.topics || []);
      setResearchInfo({ provider: data.provider || 'Website pages', searchWarning: data.searchWarning || '', summary: data.summary || '', audience: data.audience || '', sources: data.sources || [] });
      setAnalyzed(true);
      setSelected([]);
      notify(`Website analysis complete · ${data.topics?.length || 10} SEO Keyword strategies identified`);
    } catch (e) {
      setAnalyzed(false);
      const message = e.name === 'TimeoutError' ? 'Website analysis timed out.' : (e.message || 'Website analysis failed');
      setAnalysisError(message);
      notify('Website analysis needs attention');
    } finally {
      setBusy(false);
    }
  }

  async function writeBatch(indicesToDraft) {
    if (!indicesToDraft || !indicesToDraft.length) return;
    setBusy(true);
    setWritingError('');
    const total = indicesToDraft.length;
    setBatchProgress({
      active: true,
      current: 1,
      total,
      currentTopic: topics[indicesToDraft[0]]?.title || '',
      completed: []
    });

    const generated = [];

    for (let i = 0; i < indicesToDraft.length; i++) {
      const topic = topics[indicesToDraft[i]];
      if (!topic) continue;
      setBatchProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentTopic: topic.title
      }));

      try {
        const r = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic.title,
            keyword: topic.keyword,
            relatedKeywords: topic.relatedKeywords || [],
            keywordStrategy: topic.keywordStrategy || null,
            context: url,
            sources: topic.sources || []
          }),
          signal: AbortSignal.timeout(480000)
        });
        const raw = await r.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch {}
        if (!r.ok) throw Error(data.error || `HTTP ${r.status}`);
        generated.push(data);
        setArticles((prev) => [data, ...prev.filter((x) => x.id !== data.id)]);
        setBatchProgress((prev) => ({
          ...prev,
          completed: [...prev.completed, data]
        }));
      } catch (e) {
        console.error('Error drafting topic:', topic.title, e);
      }
    }

    setBusy(false);
    setBatchProgress((prev) => ({ ...prev, active: false }));
    setSelected([]);

    if (generated.length > 0) {
      setArticle(generated[0]);
      if (total > 1) {
        setTab('My articles');
        notify(`Batch complete! Successfully drafted ${generated.length} of ${total} articles.`);
      } else {
        setTab('Writer');
        notify('SEO Draft & Keyword Value Strategy generated!');
      }
    } else {
      setWritingError('Draft generation failed. Please try again.');
      notify('Draft generation encountered an issue');
    }
  }

  function write(topic) {
    const idx = topics.findIndex((t) => t.title === topic.title);
    if (idx >= 0) writeBatch([idx]);
  }

  async function save() {
    if (!article) return;
    try {
      if (article.id) {
        await fetch(`/api/articles/${article.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: article.title,
            content: article.content,
            metaData: article.metaData
          })
        });
      }
      notify('Draft & SEO Meta settings saved');
    } catch {
      notify('Saved in this session');
    }
  }

  function copyText(text, msg = 'Copied to clipboard!') {
    navigator.clipboard?.writeText(text);
    notify(msg);
  }

  function copyHtmlForCms() {
    if (!article?.content) return;
    const html = markdownToHtml(article.content);
    copyText(html, 'Formatted HTML copied! Ready to paste into WordPress / Webflow');
  }

  function downloadMarkdown() {
    if (!article) return;
    const frontmatter = `---
title: "${(article.metaData?.title || article.title).replace(/"/g, '\\"')}"
description: "${(article.metaData?.description || '').replace(/"/g, '\\"')}"
primaryKeyword: "${article.keyword || ''}"
slug: "${article.metaData?.slug || 'article'}"
date: "${new Date().toISOString().split('T')[0]}"
status: "${article.status || 'Draft'}"
---

`;
    const blob = new Blob([frontmatter + (article.content || '')], { type: 'text/markdown;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${article.metaData?.slug || 'article'}.md`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
    notify('Downloaded Markdown (.md) with SEO Frontmatter!');
  }

  const hostname = (() => {
    try { return new URL(url).hostname; } catch { return 'clientwebsite.com'; }
  })();

  const primaryStrategy = article?.keywordStrategy || {
    primaryKeyword: article?.keyword || '',
    intent: 'Commercial',
    funnelStage: 'MOFU (Middle-of-Funnel)',
    valueTag: 'High Conversion Target',
    whyItFits: `Directly targets prospective customers searching for practical solutions around "${article?.keyword}". Builds authority while driving qualified search interest.`,
    placementGuide: `Placed in Title (H1), first 100 words, and section headings to maximize Google search indexing and answer user intent immediately.`,
    relatedStrategies: (article?.relatedKeywords || []).map((rk, i) => ({
      keyword: rk,
      role: i === 0 ? 'Secondary Ranking Target' : 'Semantic Authority Anchor',
      whyUse: `Captures search variations around "${rk}" to boost topical depth without repeating the main phrase.`
    }))
  };

  const menu = [
    ['WORKSPACE', [['Overview', 'grid'], ['Website analysis', 'globe'], ['Topic ideas', 'trend'], ['Blog writer', 'edit'], ['My articles', 'file']]],
    ['PREFERENCES', [['Settings', 'settings']]]
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Icon name="spark" size={19}/></span>
          <span>signal<span className="brand-light">write</span></span>
          <span className="brand-beta">BETA</span>
        </div>
        <div className="workspace">
          <div className="workspace-avatar">N</div>
          <div><b>My workspace</b><small>Client Agency Studio</small></div>
          <span className="dots">···</span>
        </div>
        <div className="nav-wrap">
          {menu.map(([label, items]) => (
            <div className="nav-group" key={label}>
              <div className="nav-label">{label}</div>
              {items.map(([name, icon]) => (
                <button key={name} onClick={() => setTab(name)} className={'nav-item ' + (tab === name ? 'active' : '')}>
                  <Icon name={icon} size={17}/>
                  <span>{name}</span>
                  {name === 'My articles' && articles.length > 0 && <em>{articles.length}</em>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-spark"><Icon name="target" size={16}/></div>
            <b>Client SEO Engine</b>
            <p>Prove the exact business value behind every keyword you write.</p>
            <button onClick={() => setTab('Website analysis')}>Start website scan <Icon name="arrow" size={13}/></button>
          </div>
          <div className="user-row">
            <div className="user-avatar">N</div>
            <div className="user-info"><b>Nabeela</b><span>nabeela@agency.com</span></div>
            <span className="dots">···</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <Icon name="chev" size={14}/>
            <b>{tab}</b>
          </div>
          <div className="top-right">
            <span className="status-dot"/> All changes saved
            <button className="icon-button"><Icon name="clock" size={16}/></button>
            <button className="avatar-small">N</button>
          </div>
        </header>

        <div className="page">
          {tab === 'Overview' && (
            <>
              <section className="welcome">
                <div>
                  <div className="eyebrow"><span className="live-pip"/> CLIENT CONTENT STUDIO</div>
                  <h1>{(() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; })()} <span className="wave">✳</span></h1>
                  <p>Turn website data into high-value articles with transparent keyword business rationale.</p>
                </div>
                <button className="primary" onClick={() => setTab('Website analysis')}>
                  <Icon name="plus" size={17}/> New client scan
                </button>
              </section>

              <section className="hero">
                <div className="hero-copy">
                  <span className="hero-tag"><Icon name="target" size={14}/> CLIENT-GRADE SEO & EDITORIAL ENGINE</span>
                  <h2>Show the Value Behind<br/><i>Every Keyword You Target.</i></h2>
                  <p>Don't just write blogs. Demonstrate search intent, funnel stage, and ranking rationale to clients so they see the real ROI.</p>
                  <button className="hero-button" onClick={() => setTab('Website analysis')}>
                    Analyze client website <Icon name="arrow" size={15}/>
                  </button>
                  <div className="hero-proof">
                    <span className="proof-avatars"><b>N</b><b>✦</b><b>W</b></span>
                    100% transparent keyword strategy & SERP preview
                  </div>
                </div>
                <div className="hero-art">
                  <div className="orbit orbit-one"/>
                  <div className="orbit orbit-two"/>
                  <div className="art-glow"/>
                  <div className="float-card keyword-float">
                    <span className="float-icon"><Icon name="target" size={15}/></span>
                    <div><b>Keyword ROI Rationale</b><small>Search intent & funnel mapping</small></div>
                    <span className="float-check"><Icon name="check" size={13}/></span>
                  </div>
                  <div className="doc-card">
                    <div className="doc-top">
                      <span className="doc-mark"><Icon name="spark" size={15}/></span>
                      <span>STRATEGY BRIEF</span>
                      <span className="doc-dots">•••</span>
                    </div>
                    <div className="doc-title">Client Keyword Matrix<br/>& SERP Intelligence</div>
                    <div className="doc-lines"><i/><i/><i/><i/></div>
                    <div className="doc-foot">
                      <span><Icon name="check" size={13}/> MOFU · Commercial</span>
                      <span>✦ Google SERP Ready</span>
                    </div>
                  </div>
                  <div className="float-card rank-float">
                    <span className="rank-icon"><Icon name="trend" size={15}/></span>
                    <div><b>Score: 92/100</b><small>Client Deliverable Ready</small></div>
                  </div>
                </div>
              </section>

              <section className="metrics">
                <div className="metric-card">
                  <span className="metric-icon purple"><Icon name="globe" size={18}/></span>
                  <div className="metric-label">WEBSITES ANALYZED</div>
                  <div className="metric-bottom">
                    <b>{analyzed ? '1' : '0'}</b>
                    <span>{analyzed ? 'Ready for ideas' : 'Start with your site'}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <span className="metric-icon orange"><Icon name="target" size={18}/></span>
                  <div className="metric-label">KEYWORD STRATEGIES</div>
                  <div className="metric-bottom">
                    <b>{analyzed ? topics.length : '—'}</b>
                    <span>{analyzed ? 'Intent & Funnel mapped' : 'Analyzed on scan'}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <span className="metric-icon green"><Icon name="file" size={18}/></span>
                  <div className="metric-label">ARTICLES WRITTEN</div>
                  <div className="metric-bottom">
                    <b>{articles.length}</b>
                    <span>{articles.length ? 'Client drafts ready' : 'Your story starts here'}</span>
                  </div>
                </div>
                <div className="metric-card">
                  <span className="metric-icon blue"><Icon name="spark" size={18}/></span>
                  <div className="metric-label">VERIFIED SOURCES</div>
                  <div className="metric-bottom">
                    <b>{researchInfo.sources?.length || '—'}</b>
                    <span>{researchInfo.provider || 'Evidence backed'}</span>
                  </div>
                </div>
              </section>

              <section className="lower-grid">
                <div className="panel workflow">
                  <div className="panel-heading">
                    <div><h3>Your client content workflow</h3><p>From website scan to client-ready strategy deliverables.</p></div>
                    <button className="text-button" onClick={() => setTab('Website analysis')}>View workflow <Icon name="chev" size={14}/></button>
                  </div>
                  <div className="steps">
                    <div className="step">
                      <div className="step-number done"><Icon name="globe" size={17}/></div>
                      <div className="step-copy"><b>Analyze client website</b><span>Extract products, headings & audience</span></div>
                      <span className="step-state">{analyzed ? 'DONE' : 'START'}</span>
                    </div>
                    <div className="step">
                      <div className="step-number"><Icon name="target" size={17}/></div>
                      <div className="step-copy"><b>Discover keyword opportunities</b><span>Map search intent, funnel stage & ROI value</span></div>
                      <span className="step-state">NEXT</span>
                    </div>
                    <div className="step">
                      <div className="step-number"><Icon name="edit" size={17}/></div>
                      <div className="step-copy"><b>Draft evidence-backed blog</b><span>Natural keyword placement in H1, intro & H2</span></div>
                      <span className="step-state">03</span>
                    </div>
                    <div className="step">
                      <div className="step-number"><Icon name="check" size={17}/></div>
                      <div className="step-copy"><b>Client deliverable report</b><span>SERP preview, strategy matrix & 1-click export</span></div>
                      <span className="step-state">04</span>
                    </div>
                  </div>
                </div>

                <div className="panel recent">
                  <div className="panel-heading">
                    <div><h3>Recent articles</h3><p>Your latest client drafts and strategies.</p></div>
                    <button className="round-arrow" onClick={() => setTab('My articles')}><Icon name="arrow" size={15}/></button>
                  </div>
                  {articles.length ? (
                    <div className="article-mini-list">
                      {articles.slice(0, 3).map((a) => (
                        <button className="article-mini" key={a.id} onClick={() => { setArticle(a); setTab('Writer'); }}>
                          <span className="mini-file"><Icon name="file" size={15}/></span>
                          <span><b>{a.title}</b><small>{a.keyword || 'Primary keyword'} · {a.word_count || 0} words</small></span>
                          <Icon name="chev" size={14}/>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-recent">
                      <div className="empty-file"><Icon name="file" size={20}/></div>
                      <b>Your first article is one idea away</b>
                      <span>Choose a topic and start writing.</span>
                      <button onClick={() => setTab('Website analysis')}>Find a topic <Icon name="arrow" size={13}/></button>
                    </div>
                  )}
                </div>
              </section>

              <footer className="footer">
                <span>SignalWrite Agency Edition <b>✳</b></span>
                <span>Transparent keyword value. Verified content.</span>
              </footer>
            </>
          )}

          {tab === 'Website analysis' && (
            <>
              <div className="inner-head">
                <div className="eyebrow">STEP 01 · CLIENT DISCOVERY</div>
                <h1>Start with your client website.</h1>
                <p>We'll analyze products, headings, and audience language to uncover high-impact keyword opportunities.</p>
              </div>
              <div className="analysis-layout">
                <div className="panel analysis-form">
                  <label htmlFor="siteurl">Client website URL</label>
                  <div className="url-field">
                    <Icon name="link" size={17}/>
                    <input id="siteurl" placeholder="https://clientwebsite.com" value={url} onChange={(e) => setUrl(e.target.value)}/>
                  </div>
                  <span className="field-help">We'll review public pages to map their search opportunities and brand context.</span>
                  <label className="second-label">Existing blog content <span>OPTIONAL</span></label>
                  <textarea placeholder="Paste links to existing posts, or tell us what topics the client already covers…" rows="4" value={existingBlogs} onChange={(e) => setExistingBlogs(e.target.value)}/>
                  <button className="primary wide" onClick={analyze} disabled={busy}>
                    {busy ? <span className="spinner"/> : <Icon name="spark" size={16}/>}
                    {busy ? 'Analyzing client website & search intent…' : 'Analyze client website'}
                  </button>
                  {analysisError && <div className="analysis-error" role="alert">{analysisError}</div>}
                  <div className="privacy-note">🔒 Public pages only. Secure and privacy preserving.</div>
                </div>
                <div className="panel analysis-side">
                  <span className="side-icon"><Icon name="target" size={19}/></span>
                  <h3>Why keyword strategy sells.</h3>
                  <p>Clients don't buy generic articles — they buy search traffic, customer trust, and new leads.</p>
                  <div className="side-checks">
                    <span><Icon name="check" size={15}/> Search Intent: TOFU, MOFU, and BOFU mapping</span>
                    <span><Icon name="check" size={15}/> Placement Logic: Google H1, intro & H2 weighting</span>
                    <span><Icon name="check" size={15}/> Value Rationale: "Why we use this keyword" breakdown</span>
                    <span><Icon name="check" size={15}/> Live Google SERP preview for quick client approval</span>
                  </div>
                  <small>Gives you everything needed to present confident, agency-grade content plans to clients.</small>
                </div>
              </div>
              {analyzed && (
                <div className="analysis-result">
                  <div className="result-label"><span className="live-pip"/> ANALYSIS COMPLETE</div>
                  <h2>{topics.length} Keyword opportunities identified.</h2>
                  <p>Each topic contains search intent, strategic rationale, and related keyword mappings.</p>
                  <button className="primary" onClick={() => setTab('Topic ideas')}>
                    Explore {topics.length} topic strategies <Icon name="arrow" size={15}/>
                  </button>
                </div>
              )}
            </>
          )}

          {tab === 'Topic ideas' && (
            <>
              <div className="inner-head ideas-head">
                <div>
                  <div className="eyebrow">STEP 02 · STRATEGIC TOPIC SELECTION</div>
                  <h1>Content ideas with proven keyword rationale.</h1>
                  <p>Every topic includes search intent, funnel stage, and clear business justification for your client.</p>
                </div>
                <button className="outline-button" onClick={() => setTab('Website analysis')}>
                  <Icon name="globe" size={15}/>{analyzed ? 'Website analyzed' : 'Add a website'}
                </button>
              </div>

              {analyzed && (
                <div className="notice">
                  <Icon name="spark" size={16}/> Research: {researchInfo.provider || 'website pages'}. Topics include primary keyword intent, funnel stage, and strategic business rationale. {researchInfo.searchWarning && <span>{researchInfo.searchWarning}</span>}
                </div>
              )}
              {!analyzed && (
                <div className="notice">
                  <Icon name="spark" size={16}/> No website scanned yet. <button onClick={() => setTab('Website analysis')}>Analyze client website</button> to generate topics.
                </div>
              )}

              <div className="topic-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <b>{topics.length} topic opportunities</b>
                  {topics.length > 0 && (
                    <button
                      className="btn-select-all"
                      onClick={() => {
                        if (selected.length === topics.length) {
                          setSelected([]);
                        } else {
                          setSelected(topics.map((_, idx) => idx));
                        }
                      }}
                    >
                      <Icon name="check" size={12}/>
                      {selected.length === topics.length ? 'Deselect All' : `Select All (${topics.length})`}
                    </button>
                  )}
                  <span>· Select individual topics or batch generate all</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="view-mode-toggle">
                    <button
                      className={'view-mode-btn ' + (topicViewMode === 'list' ? 'active' : '')}
                      onClick={() => setTopicViewMode('list')}
                    >
                      <Icon name="grid" size={12}/> List View
                    </button>
                    <button
                      className={'view-mode-btn ' + (topicViewMode === 'calendar' ? 'active' : '')}
                      onClick={() => setTopicViewMode('calendar')}
                    >
                      <Icon name="calendar" size={12}/> 30-Day Calendar
                    </button>
                  </div>
                  <div className="search-box">
                    <Icon name="search" size={15}/>
                    <input placeholder="Search topics or keywords…" value={query} onChange={(e) => setQuery(e.target.value)}/>
                  </div>
                </div>
              </div>

              {topicViewMode === 'calendar' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px' }}>
                    <div>
                      <b style={{ fontSize: '11px', color: '#2d2a44' }}>30-Day Automated Editorial Roadmap</b>
                      <span style={{ fontSize: '9px', color: '#88859e', display: 'block' }}>
                        Strategic 4-week publishing plan moving prospects from awareness to direct purchase.
                      </span>
                    </div>
                    <button className="btn-select-all" onClick={() => window.print()}>
                      <Icon name="printer" size={12}/> Print Calendar Roadmap
                    </button>
                  </div>

                  <div className="calendar-grid">
                    {/* Week 1 */}
                    <div className="calendar-col">
                      <div className="calendar-col-head">
                        <b>Week 1 · Days 1–7</b>
                        <span>TOFU · Discovery & Search</span>
                      </div>
                      {topics.slice(0, 2).map((t, i) => (
                        <div className="calendar-card" key={t.title}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="calendar-day-badge">Day 0{i * 3 + 2}</span>
                            <span className="funnel-badge">TOFU</span>
                          </div>
                          <h4>{t.title}</h4>
                          <p>{t.reason}</p>
                          <div className="calendar-card-foot">
                            <span className="keyword-tag"><Icon name="target" size={10}/> {t.keyword}</span>
                            <button className="write-one" style={{ margin: 0, padding: '4px 7px' }} onClick={() => write(t)}>
                              Draft
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Week 2 */}
                    <div className="calendar-col">
                      <div className="calendar-col-head">
                        <b>Week 2 · Days 8–14</b>
                        <span>MOFU · Deep Guides</span>
                      </div>
                      {topics.slice(2, 5).map((t, i) => (
                        <div className="calendar-card" key={t.title}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="calendar-day-badge">Day {i * 2 + 8}</span>
                            <span className="funnel-badge">MOFU</span>
                          </div>
                          <h4>{t.title}</h4>
                          <p>{t.reason}</p>
                          <div className="calendar-card-foot">
                            <span className="keyword-tag"><Icon name="target" size={10}/> {t.keyword}</span>
                            <button className="write-one" style={{ margin: 0, padding: '4px 7px' }} onClick={() => write(t)}>
                              Draft
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Week 3 */}
                    <div className="calendar-col">
                      <div className="calendar-col-head">
                        <b>Week 3 · Days 15–21</b>
                        <span>MOFU · Trust & Compare</span>
                      </div>
                      {topics.slice(5, 8).map((t, i) => (
                        <div className="calendar-card" key={t.title}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="calendar-day-badge">Day {i * 2 + 15}</span>
                            <span className="intent-badge">Commercial</span>
                          </div>
                          <h4>{t.title}</h4>
                          <p>{t.reason}</p>
                          <div className="calendar-card-foot">
                            <span className="keyword-tag"><Icon name="target" size={10}/> {t.keyword}</span>
                            <button className="write-one" style={{ margin: 0, padding: '4px 7px' }} onClick={() => write(t)}>
                              Draft
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Week 4 */}
                    <div className="calendar-col">
                      <div className="calendar-col-head">
                        <b>Week 4 · Days 22–30</b>
                        <span>BOFU · Decision & Leads</span>
                      </div>
                      {topics.slice(8, 10).map((t, i) => (
                        <div className="calendar-card" key={t.title}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="calendar-day-badge">Day {i * 3 + 23}</span>
                            <span className="value-badge">High Conversion</span>
                          </div>
                          <h4>{t.title}</h4>
                          <p>{t.reason}</p>
                          <div className="calendar-card-foot">
                            <span className="keyword-tag"><Icon name="target" size={10}/> {t.keyword}</span>
                            <button className="write-one" style={{ margin: 0, padding: '4px 7px' }} onClick={() => write(t)}>
                              Draft
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="topic-list">
                  {topics.filter((t) => t.title.toLowerCase().includes(query.toLowerCase()) || t.keyword.toLowerCase().includes(query.toLowerCase())).map((t, i) => {
                    const strat = t.keywordStrategy || {};
                    return (
                      <div className={'topic-card ' + (selected.includes(i) ? 'selected' : '')} key={t.title}>
                        <button className={'topic-check ' + (selected.includes(i) ? 'checked' : '')} onClick={() => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}>
                          {selected.includes(i) && <Icon name="check" size={13}/>}
                        </button>
                        <div className="topic-main">
                          <div className="topic-overline">
                            <span className="funnel-badge">{strat.funnelStage || t.funnelStage || 'MOFU'}</span>
                            <span className="intent-badge">{t.intent || 'Commercial'}</span>
                            <span className="value-badge">{strat.valueTag || t.valueTag || 'High Value Target'}</span>
                            <i></i> TOPIC {String(i + 1).padStart(2, '0')}
                          </div>
                          <h3>{t.title}</h3>
                          <p>{t.reason}</p>

                          {/* Keyword Strategy & Why Box */}
                          <div className="keyword-value-box">
                            <div className="keyword-value-head">
                              <span className="keyword-tag"><Icon name="target" size={13}/> Primary Target: <b>{t.keyword}</b></span>
                              <small style={{ color: '#7a7694', fontSize: '8px' }}>Google SEO Placement Strategy</small>
                            </div>
                            <div className="keyword-why">
                              <b>Why We Target This Keyword: </b>
                              {strat.whyItFits || 'Directly addresses qualified buyer search queries for this business niche.'}
                            </div>
                            <div className="keyword-placement-tip">
                              📌 <b>Placement Plan:</b> {strat.placementGuide || `Target "${t.keyword}" in the H1 title, opening 100 words, and section headings.`}
                            </div>
                          </div>

                          {t.conversionHook && (
                            <div className="lead-hook-box">
                              <Icon name="target" size={13}/>
                              <div>
                                <b>Lead Conversion Hook: </b>{t.conversionHook}
                                {t.suggestedCta && (
                                  <div><span className="lead-cta-tag">💼 CTA Offer: {t.suggestedCta}</span></div>
                                )}
                              </div>
                            </div>
                          )}

                          {t.relatedKeywords?.length > 0 && (
                            <div className="related-keywords">
                              <small>Supporting semantic keywords (builds topic depth without keyword stuffing):</small>
                              {t.relatedKeywords.map((k) => (
                                <span className="tag" key={typeof k === 'object' ? k.keyword : k}>
                                  {typeof k === 'object' ? `${k.keyword} (${k.role || 'Semantic'})` : k}
                                </span>
                              ))}
                            </div>
                          )}

                          {t.sources?.length > 0 && (
                            <details className="topic-evidence">
                              <summary>View {t.sources.length} evidence sources</summary>
                              <div className="source-list">
                                {t.sources.map((s) => (
                                  <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                                    <b>[{s.id}] {s.title}</b>
                                    <span>{s.snippet}</span>
                                  </a>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                        <button className="write-one" disabled={busy} onClick={() => writeBatch([i])}>
                          Draft article <Icon name="arrow" size={14}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {analyzed && topics.length === 0 && (
                <div className="panel writer-empty">
                  <h3>No topic ideas available yet.</h3>
                  <p>Check that the website URL is accessible and try scanning again.</p>
                  <button className="primary" onClick={() => setTab('Website analysis')}>Review website URL</button>
                </div>
              )}

              <div className="selection-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>{selected.length ? `${selected.length} of ${topics.length} topics selected` : 'Select topics above to batch draft'}</span>
                  {selected.length > 0 && (
                    <button className="text-button" onClick={() => setSelected([])} style={{ fontSize: '9px', color: '#88859e' }}>
                      Clear selection
                    </button>
                  )}
                </div>
                <button
                  className="primary"
                  disabled={!selected.length || busy}
                  onClick={() => writeBatch(selected)}
                  style={{ minWidth: '190px' }}
                >
                  {busy ? <span className="spinner"/> : <Icon name="spark" size={14}/>}
                  {busy
                    ? 'Drafting articles…'
                    : selected.length === 1
                    ? 'Draft 1 Selected Article'
                    : selected.length === topics.length && topics.length > 1
                    ? `Draft All ${topics.length} Articles (Bulk)`
                    : `Draft ${selected.length} Selected Articles (Batch)`}
                </button>
              </div>
            </>
          )}

          {tab === 'Writer' && (
            <>
              <div className="inner-head writer-header">
                <div>
                  <div className="eyebrow">STEP 03 · CLIENT CONTENT STUDIO</div>
                  <h1>{article ? article.title : 'Let’s make something worth reading.'}</h1>
                  <p>{article ? 'Draft complete with natural keyword placement and verifiable evidence.' : 'Choose one of your topic ideas to open the writing studio.'}</p>
                </div>
                {article && (
                  <div className="writer-actions">
                    <button className="outline-button" onClick={() => setShowReportModal(true)} title="View client-facing strategy report">
                      <Icon name="file" size={14}/> Client SEO Report
                    </button>
                    <button className="outline-button" onClick={copyHtmlForCms} title="Copy clean HTML for WordPress, Shopify, or Webflow">
                      <Icon name="copy" size={14}/> Copy HTML
                    </button>
                    <button className="outline-button" onClick={downloadMarkdown} title="Download Markdown (.md) with SEO Frontmatter">
                      <Icon name="file" size={14}/> Download .md
                    </button>
                    <button className="primary" onClick={save}>
                      Save draft
                    </button>
                  </div>
                )}
              </div>

              {article && (() => {
                const sameArticle = (a) => (article.id != null ? a.id === article.id : a.title === article.title);
                const index = articles.findIndex(sameArticle);
                if (index < 0 || articles.length < 2) return null;
                const go = (step) => {
                  const target = articles[index + step];
                  if (!target) return;
                  // Keep unsaved edits in this session's list so coming back doesn't lose them.
                  setArticles((prev) => prev.map((a) => (sameArticle(a) ? article : a)));
                  setArticle(target);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                };
                return (
                  <div className="article-nav">
                    <button className="outline-button" disabled={index === 0} onClick={() => go(-1)} title={articles[index - 1]?.title || ''}>
                      ← Previous
                    </button>
                    <span className="article-nav-count">Article {index + 1} of {articles.length}</span>
                    <button className="outline-button" disabled={index === articles.length - 1} onClick={() => go(1)} title={articles[index + 1]?.title || ''}>
                      Next →
                    </button>
                  </div>
                );
              })()}

              {article ? (
                <div className="editor-layout">
                  <div className="panel editor-panel">
                    <div className="editor-meta">
                      <span className="keyword-tag"><Icon name="target" size={12}/>{article.keyword}</span>
                      <span>{article.content?.split(/\s+/).filter(Boolean).length || 0} words</span>
                      <span style={{ color: seo?.gradeColor, fontWeight: 700 }}>
                        Score: {seo?.score || 0}/100 ({seo?.grade})
                      </span>
                    </div>
                    <textarea
                      className="article-editor"
                      value={article.content || ''}
                      onChange={(e) => setArticle({ ...article, content: e.target.value })}
                      placeholder="Article content in Markdown…"
                    />
                    <div className="editor-foot">
                      <span>Markdown supported · Live keyword auditing</span>
                      <span>Changes save when you click Save draft</span>
                    </div>
                  </div>

                  {/* SEO & Strategic Value Panel */}
                  <div className="panel seo-panel">
                    <div className="seo-top">
                      <span className="metric-icon green"><Icon name="spark" size={16}/></span>
                      <div>
                        <b>SEO Strategy Suite</b>
                        <small>Keyword Rationale & SERP Intelligence</small>
                      </div>
                    </div>

                    {/* Subtabs: Strategy | SERP | Social | FAQ | Evidence */}
                    <div className="seo-subtabs">
                      <button className={'seo-subtab ' + (seoSubtab === 'strategy' ? 'active' : '')} onClick={() => setSeoSubtab('strategy')}>
                        Keywords
                      </button>
                      <button className={'seo-subtab ' + (seoSubtab === 'serp' ? 'active' : '')} onClick={() => setSeoSubtab('serp')}>
                        SERP
                      </button>
                      <button className={'seo-subtab ' + (seoSubtab === 'social' ? 'active' : '')} onClick={() => setSeoSubtab('social')}>
                        Repurpose
                      </button>
                      <button className={'seo-subtab ' + (seoSubtab === 'faq' ? 'active' : '')} onClick={() => setSeoSubtab('faq')}>
                        FAQ Schema
                      </button>
                      <button className={'seo-subtab ' + (seoSubtab === 'evidence' ? 'active' : '')} onClick={() => setSeoSubtab('evidence')}>
                        Sources ({article.sources?.length || 0})
                      </button>
                    </div>

                    {seoSubtab === 'strategy' && (
                      <div>
                        {/* Overall SEO Score Bar */}
                        <div className="seo-score-bar-wrap">
                          <div className="score-flex">
                            <span className="score-num">{seo.score} <small style={{ fontSize: '10px', color: '#908ea0' }}>/ 100</small></span>
                            <span className="score-grade" style={{ background: '#f0fdf4', color: seo.gradeColor }}>
                              {seo.grade}
                            </span>
                          </div>
                          <div className="score-progress-track">
                            <div className="score-progress-fill" style={{ width: `${seo.score}%` }}/>
                          </div>
                          <div className="score-breakdown">
                            <span>{seo.title ? '✓' : '○'} Title (H1) +25</span>
                            <span>{seo.intro ? '✓' : '○'} Opening +20</span>
                            <span>{seo.heading ? '✓' : '○'} Headings +20</span>
                            <span>{seo.count >= 2 ? '✓' : '○'} Density ({seo.count}x) +15</span>
                          </div>
                        </div>

                        {/* Lead Generation & CTA Status Box */}
                        <div className="lead-hook-box">
                          <Icon name="target" size={14}/>
                          <div>
                            <b>Lead Generation Engine: Active 🎯</b>
                            <p style={{ margin: '3px 0 0', fontSize: '8px', color: '#166534' }}>
                              Article includes a dedicated Call-to-Action section directing readers to {hostname} for consultations, quotes, and custom assessments.
                            </p>
                          </div>
                        </div>

                        {/* Primary Target Value Explainer */}
                        <div className="keyword-value-box">
                          <div className="keyword-value-head">
                            <span className="keyword-tag"><Icon name="target" size={12}/> {article.keyword}</span>
                            <span className="funnel-badge">{primaryStrategy.funnelStage}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                            <span className="intent-badge">{primaryStrategy.intent}</span>
                            <span className="value-badge">{primaryStrategy.valueTag}</span>
                          </div>
                          <div className="keyword-why">
                            <b>Why We Use This: </b>
                            {primaryStrategy.whyItFits}
                          </div>

                          <div className="placement-checklist">
                            <div className={'placement-item ' + (seo.title ? 'ok' : 'miss')}>
                              <Icon name={seo.title ? 'check' : 'target'} size={13}/>
                              <div>
                                <b>Title (H1): {seo.title ? 'Optimized' : 'Missing'}</b>
                                <small>Highest ranking signal for search engine crawlers.</small>
                              </div>
                            </div>
                            <div className={'placement-item ' + (seo.intro ? 'ok' : 'miss')}>
                              <Icon name={seo.intro ? 'check' : 'target'} size={13}/>
                              <div>
                                <b>Opening 100 Words: {seo.intro ? 'Confirmed' : 'Missing'}</b>
                                <small>Validates search intent immediately to reduce bounce rate.</small>
                              </div>
                            </div>
                            <div className={'placement-item ' + (seo.heading ? 'ok' : 'miss')}>
                              <Icon name={seo.heading ? 'check' : 'target'} size={13}/>
                              <div>
                                <b>H2 Subheadings: {seo.heading ? 'Targeted' : 'Missing'}</b>
                                <small>Helps win Google featured snippets and passage ranking.</small>
                              </div>
                            </div>
                            <div className="placement-item ok">
                              <Icon name="check" size={13}/>
                              <div>
                                <b>Frequency: {seo.count} mentions</b>
                                <small>Natural editorial distribution; prevents keyword stuffing penalties.</small>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Supporting / Related Keywords */}
                        <div style={{ marginTop: '12px' }}>
                          <b style={{ fontSize: '9px', color: '#434057', display: 'block', marginBottom: '6px' }}>
                            Supporting Keywords & Topical Depth
                          </b>
                          {(article.relatedKeywords || []).map((term, idx) => {
                            const isUsed = seo.relatedUsed.includes(term);
                            return (
                              <div className="related-strategy-item" key={term}>
                                <div className="related-strategy-top">
                                  <b>{isUsed ? '✓' : '○'} {term}</b>
                                  <span>{isUsed ? 'Active in draft' : 'Suggested'}</span>
                                </div>
                                <p>Captures long-tail search variations and reinforces topical authority.</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {seoSubtab === 'serp' && (
                      <div>
                        <div className="serp-device-toggle">
                          <button className={'serp-device-btn ' + (serpDevice === 'desktop' ? 'active' : '')} onClick={() => setSerpDevice('desktop')}>
                            <Icon name="desktop" size={12}/> Desktop
                          </button>
                          <button className={'serp-device-btn ' + (serpDevice === 'mobile' ? 'active' : '')} onClick={() => setSerpDevice('mobile')}>
                            <Icon name="mobile" size={12}/> Mobile
                          </button>
                        </div>

                        {/* Live Google Search Result Box */}
                        <div className={'serp-card ' + (serpDevice === 'mobile' ? 'mobile' : '')}>
                          <div className="serp-head">
                            <div className="serp-fav">G</div>
                            <div className="serp-url-wrap">
                              <span className="serp-site">{hostname}</span>
                              <span className="serp-breadcrumb">https://{hostname} › blog › {article.metaData?.slug || 'article'}</span>
                            </div>
                          </div>
                          <span className="serp-title">
                            {article.metaData?.title || article.title}
                          </span>
                          <p className="serp-desc">
                            {highlightKeywords(article.metaData?.description || `${article.title}. In-depth guide with actionable insights and proven strategies.`, article.keyword)}
                          </p>
                        </div>

                        {/* Meta Tags Quick Editor */}
                        <div className="serp-meta-edit">
                          <label>
                            <span>Meta Title</span>
                            <span>{(article.metaData?.title || article.title).length}/60 chars</span>
                          </label>
                          <input
                            value={article.metaData?.title || article.title}
                            onChange={(e) => setArticle({ ...article, metaData: { ...article.metaData, title: e.target.value } })}
                          />

                          <label>
                            <span>Meta Description</span>
                            <span>{(article.metaData?.description || '').length}/160 chars</span>
                          </label>
                          <textarea
                            rows="3"
                            value={article.metaData?.description || ''}
                            onChange={(e) => setArticle({ ...article, metaData: { ...article.metaData, description: e.target.value } })}
                            placeholder="Compelling 155-character summary with primary keyword..."
                          />

                          <label>
                            <span>URL Slug</span>
                            <span>/{article.metaData?.slug || 'article'}</span>
                          </label>
                          <input
                            value={article.metaData?.slug || ''}
                            onChange={(e) => setArticle({ ...article, metaData: { ...article.metaData, slug: e.target.value } })}
                          />
                        </div>
                      </div>
                    )}

                    {seoSubtab === 'social' && (() => {
                      const rp = article.repurposed || generateRepurposed(article, url);
                      return (
                        <div>
                          <p style={{ fontSize: '9px', color: '#908ea0', marginBottom: '10px', lineHeight: '1.5' }}>
                            1-Click Multi-Channel Repurposer · Publish to 3 channels from one article
                          </p>

                          {/* LinkedIn */}
                          <div className="social-snippet-card">
                            <div className="social-snippet-head">
                              <span style={{ fontWeight: 700, fontSize: '10px' }}>💼 LinkedIn — Thought Leadership Post</span>
                              <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(rp.linkedin || rp.linkedinPost || ''); notify('LinkedIn post copied!'); }}>
                                <Icon name="copy" size={11}/> Copy
                              </button>
                            </div>
                            <pre className="social-snippet-body">{rp.linkedin || rp.linkedinPost || ''}</pre>
                          </div>

                          {/* Twitter/X Thread */}
                          <div className="social-snippet-card">
                            <div className="social-snippet-head">
                              <span style={{ fontWeight: 700, fontSize: '10px' }}>🐦 Twitter/X — 5-Tweet Thread</span>
                              <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(rp.twitterText || rp.twitterThread || ''); notify('Twitter thread copied!'); }}>
                                <Icon name="copy" size={11}/> Copy
                              </button>
                            </div>
                            <pre className="social-snippet-body">{rp.twitterText || rp.twitterThread || ''}</pre>
                          </div>

                          {/* Email Newsletter */}
                          <div className="social-snippet-card">
                            <div className="social-snippet-head">
                              <span style={{ fontWeight: 700, fontSize: '10px' }}>📧 Email Newsletter Teaser</span>
                              <button className="copy-btn" onClick={() => {
                                const nl = rp.newsletter || rp.emailNewsletter || {};
                                const sub = nl.subject || '';
                                const body = nl.body || nl.bodyText || '';
                                navigator.clipboard.writeText(`Subject: ${sub}\n\n${body}`);
                                notify('Email newsletter copied!');
                              }}>
                                <Icon name="copy" size={11}/> Copy
                              </button>
                            </div>
                            {(() => {
                              const nl = rp.newsletter || rp.emailNewsletter || {};
                              return (
                                <>
                                  <div style={{ fontSize: '9px', color: '#634ed0', fontWeight: 700, marginBottom: '4px' }}>
                                    Subject: {nl.subject || nl.subjectLine || '—'}
                                  </div>
                                  <pre className="social-snippet-body">{nl.body || nl.bodyText || ''}</pre>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })()}

                    {seoSubtab === 'faq' && (() => {
                      const faqData = article.faqSchema || generateFaqJsonLd(article);
                      const qaList = faqData.qaList || [];
                      const scriptTag = faqData.scriptTag || '';
                      return (
                        <div>
                          <p style={{ fontSize: '9px', color: '#908ea0', marginBottom: '10px', lineHeight: '1.5' }}>
                            Google FAQ Schema Generator · Paste the JSON-LD into your website &lt;head&gt; for rich search snippets
                          </p>

                          {/* Q&A Preview */}
                          <div style={{ marginBottom: '10px' }}>
                            <b style={{ fontSize: '9px', color: '#434057', display: 'block', marginBottom: '6px' }}>FAQ Preview (3 Q&As)</b>
                            {qaList.map((item, idx) => (
                              <div key={idx} style={{ background: '#f4f3fb', borderRadius: '8px', padding: '8px 10px', marginBottom: '6px' }}>
                                <div style={{ fontSize: '9px', fontWeight: 700, color: '#3b3758', marginBottom: '3px' }}>
                                  Q{idx + 1}: {item.q}
                                </div>
                                <div style={{ fontSize: '9px', color: '#635f7a', lineHeight: '1.5' }}>
                                  {item.a}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* JSON-LD Script Tag */}
                          <div className="social-snippet-head" style={{ marginBottom: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '10px' }}>📋 JSON-LD Script Tag</span>
                            <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(scriptTag); notify('FAQ JSON-LD schema copied!'); }}>
                              <Icon name="copy" size={11}/> Copy
                            </button>
                          </div>
                          <pre className="schema-code-box">{scriptTag}</pre>

                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 10px', marginTop: '10px' }}>
                            <b style={{ fontSize: '9px', color: '#166534', display: 'block', marginBottom: '3px' }}>✅ How to use:</b>
                            <p style={{ fontSize: '8px', color: '#166534', margin: 0, lineHeight: '1.6' }}>
                              Paste the JSON-LD &lt;script&gt; block into your page &lt;head&gt; or before &lt;/body&gt;.
                              Google will display your FAQ as rich search snippets, increasing click-through rate.
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {seoSubtab === 'evidence' && (
                      <div>
                        <div className="seo-score">
                          <div>
                            <b>{article.evidenceReview?.status === 'reviewed' ? 'Evidence verified' : 'Manual verification recommended'}</b>
                            <span>{article.evidenceReview?.note || 'Verify factual claims against linked sources.'}</span>
                          </div>
                        </div>

                        <div className="source-list" style={{ marginTop: '12px' }}>
                          {article.sources?.map((s) => (
                            <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                              <b>[{s.id}] {s.title}</b>
                              <span>{s.provider || s.kind || 'Source'}{s.publishedDate ? ` | ${s.publishedDate}` : ''}</span>
                            </a>
                          ))}
                        </div>

                        {article.evidenceReview?.flaggedClaims?.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <b style={{ fontSize: '9px', color: '#9a3434' }}>Flagged claims to check:</b>
                            {article.evidenceReview.flaggedClaims.map((claim, idx) => (
                              <div className="analysis-error" key={idx} style={{ marginTop: '6px' }}>
                                <b>Claim:</b> "{claim.claim}"<br/>
                                <small>{claim.reason}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel writer-empty">
                  <div className="empty-file"><Icon name="edit" size={21}/></div>
                  <h3>{busy ? 'Researching and writing draft…' : writingError ? 'Draft not saved' : 'Your client writing studio is ready.'}</h3>
                  <p>{busy ? 'SignalWrite is analyzing evidence and drafting with keyword placement rules…' : writingError || 'Pick a topic idea to build an SEO-optimized first draft.'}</p>
                  {!busy && (
                    <button className="primary" onClick={() => setTab('Topic ideas')}>
                      {writingError ? 'Back to topic ideas' : 'Choose a topic'} <Icon name="arrow" size={14}/>
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'My articles' && (
            <>
              <div className="inner-head">
                <div className="eyebrow">YOUR CLIENT PORTFOLIO</div>
                <h1>My articles & deliverables.</h1>
                <p>Every article saved with complete keyword strategy and metadata.</p>
              </div>
              <div className="article-list-panel panel">
                {articles.length ? (
                  articles.map((a, i) => (
                    <button className="article-row" key={a.id || i} onClick={() => { setArticle(a); setTab('Writer'); }}>
                      <span className="row-icon"><Icon name="file" size={17}/></span>
                      <span className="row-title">
                        <b>{a.title}</b>
                        <small>🎯 {a.keyword || 'Primary keyword'} · {a.keywordStrategy?.funnelStage || 'MOFU'}</small>
                      </span>
                      <span className="row-status">{a.status || 'Draft'}</span>
                      <span className="row-words">{a.word_count || 0} words</span>
                      <Icon name="chev" size={15}/>
                    </button>
                  ))
                ) : (
                  <div className="empty-recent large">
                    <div className="empty-file"><Icon name="file" size={20}/></div>
                    <b>No articles yet.</b>
                    <span>Your generated client articles will appear here.</span>
                    <button onClick={() => setTab('Topic ideas')}>Find a topic <Icon name="arrow" size={13}/></button>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'Settings' && (
            <>
              <div className="inner-head">
                <div className="eyebrow">COMMERCIAL BLUEPRINT & PRICING</div>
                <h1>Agency settings & client sales pitch.</h1>
                <p>Everything you need to package, pitch, and sell this tool to paying clients.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: '16px' }}>
                <div className="panel settings-panel" style={{ maxWidth: 'none' }}>
                  <h3 style={{ font: '700 13px Manrope', margin: '0 0 12px', color: '#2b2940' }}>Agency Configuration</h3>
                  <label>Agency Workspace</label>
                  <input value="SignalWrite Agency Suite" readOnly/>
                  <label>Default Brand Voice</label>
                  <textarea placeholder="e.g. Authoritative, conversion-focused, direct, actionable, backed by real data." rows="3"/>
                  <label>Target Audience (ICP)</label>
                  <input placeholder="e.g. Founders, Marketing Leaders, B2B Decision Makers"/>
                  <button className="primary" onClick={() => notify('Agency settings saved')}>Save preferences</button>
                </div>

                <div className="panel">
                  <h3 style={{ font: '700 13px Manrope', margin: '0 0 4px', color: '#2b2940' }}>How to Price & Sell This to Clients</h3>
                  <p style={{ fontSize: '9px', color: '#7a778e', margin: '0 0 12px' }}>Use this proven monetization structure to close client retainers:</p>

                  <div className="roi-metric-grid" style={{ marginBottom: '14px' }}>
                    <div className="roi-metric-box">
                      <b>$250–$500</b>
                      <span>Per Article Charge</span>
                    </div>
                    <div className="roi-metric-box">
                      <b>$999/mo</b>
                      <span>Monthly Retainer (4x)</span>
                    </div>
                    <div className="roi-metric-box">
                      <b>85%</b>
                      <span>Agency Margin</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '8px', fontSize: '9px', color: '#4a485e', lineHeight: 1.55 }}>
                    <div style={{ background: '#fcfbfe', border: '1px solid #ebe7f7', borderRadius: '7px', padding: '9px 12px' }}>
                      <b>💼 Why Clients Buy: Guaranteed Lead CTA</b>
                      <p style={{ margin: '2px 0 0', color: '#7e7b91', fontSize: '8px' }}>"Every blog includes a custom next-step CTA driving readers to book a call or buy your services."</p>
                    </div>
                    <div style={{ background: '#fcfbfe', border: '1px solid #ebe7f7', borderRadius: '7px', padding: '9px 12px' }}>
                      <b>📊 Why Clients Buy: Transparent Keyword ROI</b>
                      <p style={{ margin: '2px 0 0', color: '#7e7b91', fontSize: '8px' }}>"You receive a 1-click strategy deliverable report showing search intent, funnel stage, and Google SERP previews."</p>
                    </div>
                    <div style={{ background: '#fcfbfe', border: '1px solid #ebe7f7', borderRadius: '7px', padding: '9px 12px' }}>
                      <b>⚡ Why Clients Buy: 10x Faster Content Engine</b>
                      <p style={{ margin: '2px 0 0', color: '#7e7b91', fontSize: '8px' }}>"Turn website insights into 10 published, fact-checked, lead-generating articles in an afternoon."</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* CLIENT-FACING STRATEGY DELIVERABLE REPORT MODAL */}
      {showReportModal && article && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div className="client-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <h2><Icon name="target" size={18}/> Client SEO Strategy & Content Deliverable</h2>
              <div className="report-modal-actions">
                <button className="outline-button" onClick={() => window.print()}>
                  <Icon name="printer" size={13}/> Print / Save PDF
                </button>
                <button className="outline-button" onClick={copyHtmlForCms}>
                  <Icon name="copy" size={13}/> Copy HTML
                </button>
                <button className="outline-button" onClick={() => setShowReportModal(false)}>
                  <Icon name="x" size={14}/>
                </button>
              </div>
            </div>

            <div className="report-modal-body">
              <div className="report-brand-bar">
                <div>
                  <h1>SEO CONTENT BRIEF & STRATEGY REPORT</h1>
                  <span>Prepared with SignalWrite Agency Studio</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b style={{ color: seo?.gradeColor, fontSize: '13px' }}>SEO Readiness: {seo?.score}/100</b>
                  <div style={{ fontSize: '9px', color: '#88859e' }}>Status: {seo?.grade}</div>
                </div>
              </div>

              <div className="report-client-meta">
                <div className="report-meta-cell">
                  <b>Client Website</b>
                  <span>{hostname}</span>
                </div>
                <div className="report-meta-cell">
                  <b>Primary Search Target</b>
                  <span style={{ color: '#5843c0' }}>{article.keyword}</span>
                </div>
                <div className="report-meta-cell">
                  <b>Search Funnel Stage</b>
                  <span>{primaryStrategy.funnelStage}</span>
                </div>
                <div className="report-meta-cell">
                  <b>Search Intent</b>
                  <span>{primaryStrategy.intent}</span>
                </div>
              </div>

              {/* SERP Snippet Preview */}
              <h3 style={{ font: '700 13px Manrope', margin: '14px 0 8px', color: '#312f48' }}>
                Google Search Appearance (SERP Snippet)
              </h3>
              <div className="serp-card" style={{ maxWidth: '640px' }}>
                <div className="serp-head">
                  <div className="serp-fav">G</div>
                  <div className="serp-url-wrap">
                    <span className="serp-site">{hostname}</span>
                    <span className="serp-breadcrumb">https://{hostname} › blog › {article.metaData?.slug || 'article'}</span>
                  </div>
                </div>
                <span className="serp-title">{article.metaData?.title || article.title}</span>
                <p className="serp-desc">{article.metaData?.description || article.title}</p>
              </div>

              {/* The Keyword Strategy Matrix (The Boss's Core Requirement) */}
              <h3 style={{ font: '700 13px Manrope', margin: '22px 0 8px', color: '#312f48' }}>
                Keyword Strategy Matrix & Business Value Proposition
              </h3>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Keyword Phrase</th>
                      <th>Role & Type</th>
                      <th>Search Intent</th>
                      <th>Funnel Stage</th>
                      <th>Why We Use This (Client Value Proposition)</th>
                      <th>Placement Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><b>{article.keyword}</b></td>
                      <td><span className="keyword-tag">Primary Ranking Target</span></td>
                      <td><span className="intent-badge">{primaryStrategy.intent}</span></td>
                      <td><span className="funnel-badge">{primaryStrategy.funnelStage}</span></td>
                      <td>{primaryStrategy.whyItFits}</td>
                      <td>
                        <span style={{ color: '#2e9b64', fontWeight: 600 }}>
                          {seo.title ? '✓ In Title' : ''} {seo.intro ? '✓ In Intro' : ''} {seo.heading ? '✓ In H2' : ''} ({seo.count}x)
                        </span>
                      </td>
                    </tr>
                    {(article.relatedKeywords || []).map((term) => {
                      const isUsed = seo.relatedUsed.includes(term);
                      return (
                        <tr key={term}>
                          <td><b>{term}</b></td>
                          <td><span className="tag">Semantic Supporting Term</span></td>
                          <td><span className="intent-badge">Informational</span></td>
                          <td><span className="funnel-badge">TOFU / MOFU</span></td>
                          <td>Captures searchers exploring sub-topics; broadens organic reach without spamming main phrase.</td>
                          <td>
                            <span style={{ color: isUsed ? '#2e9b64' : '#88859d', fontWeight: 600 }}>
                              {isUsed ? '✓ Present in article' : '○ Supporting concept'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Verified Sources */}
              {article.sources?.length > 0 && (
                <div style={{ marginTop: '18px' }}>
                  <h3 style={{ font: '700 13px Manrope', margin: '0 0 8px', color: '#312f48' }}>
                    Fact-Checking & Research Evidence ({article.sources.length} sources linked)
                  </h3>
                  <div className="source-list">
                    {article.sources.map((s) => (
                      <a key={s.id} href={s.url} target="_blank" rel="noreferrer">
                        <b>[{s.id}] {s.title}</b>
                        <span>{s.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Article Content */}
              <h3 style={{ font: '700 13px Manrope', margin: '22px 0 8px', color: '#312f48' }}>
                Full Article Draft ({article.content?.split(/\s+/).filter(Boolean).length || 0} words)
              </h3>
              <div className="report-article-preview">
                {article.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BATCH DRAFTING PROGRESS MODAL */}
      {batchProgress.active && (
        <div className="modal-overlay">
          <div className="batch-modal">
            <div className="batch-modal-head">
              <span className="metric-icon purple"><Icon name="spark" size={20}/></span>
              <div>
                <h3>Drafting {batchProgress.total} Client Articles</h3>
                <p>Applying SEO keyword strategy, fact-checking evidence & SERP optimization...</p>
              </div>
            </div>

            <div className="batch-meter-track">
              <div
                className="batch-meter-fill"
                style={{ width: `${Math.round(((batchProgress.current - 1) / batchProgress.total) * 100)}%` }}
              />
            </div>
            <div className="batch-percent">
              <span>Article {batchProgress.current} of {batchProgress.total}</span>
              <span>{Math.round(((batchProgress.current - 1) / batchProgress.total) * 100)}% Complete</span>
            </div>

            <div className="batch-current-box">
              <b>Currently drafting: "{batchProgress.currentTopic}"</b>
              <span>
                <span className="spinner" style={{ width: '10px', height: '10px', borderColor: '#735fd144', borderTopColor: '#735fd1' }}/>
                Researching outline, placing keywords naturally, and generating metadata...
              </span>
            </div>

            {batchProgress.completed?.length > 0 && (
              <div style={{ marginTop: '14px' }}>
                <small style={{ fontSize: '8px', color: '#7f7c93', fontWeight: 700, textTransform: 'uppercase' }}>
                  Completed in this batch ({batchProgress.completed.length}/{batchProgress.total}):
                </small>
                <div className="batch-completed-list">
                  {batchProgress.completed.map((comp) => (
                    <div className="batch-done-item" key={comp.id || comp.title}>
                      <Icon name="check" size={13}/>
                      <span><b>{comp.title}</b> ({comp.word_count || 0} words)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <Icon name="check" size={16}/>{toast}
        </div>
      )}
      {setup && (
        <div className="setup-banner">
          <span><b>Free mode</b> · Website-based starter topics and preview drafts work without API billing. AI writing and trend research are off.</span>
          <button onClick={() => setSetup(false)}>Got it</button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
