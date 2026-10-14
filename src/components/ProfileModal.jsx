import React, { useEffect, useState } from 'react';
import { ArrowRight, FileText, ExternalLink, Compass, Heart, BookOpen, Quote, Check } from 'lucide-react';
import { api } from '../services/api';
import { Dialog, Avatar, SourceLinks, Loading, ErrorNotice, formatTimestamp } from './UI';

const categories = [['needs', 'Needs', Heart], ['hobbies', 'Hobbies', Compass], ['interests', 'Interests', BookOpen], ['qualities', 'Public qualities', Check]];
function EvidenceList({ analysis, category, title, Icon, onClaim }) {
  const items = analysis[category] || [];
  const claims = analysis.claims || [];
  return <section className="analysis-section"><h3><Icon size={17} />{title}</h3>{items.length ? <ul>{items.map((item, index) => {
    const sourceCategory = { hobbies: 'hobby', interests: 'interest' }[category] || category;
    const claim = claims.find(claim => claim.category === sourceCategory && claim.label.toLowerCase() === String(item).toLowerCase());
    return <li key={`${item}-${index}`}><strong>{item}</strong>{claim ? <button type="button" onClick={() => onClaim(claim.id)} className="evidence-inline">{claim.source} · {claim.id}</button> : category === 'needs' ? <span className="muted">Not established by these sources</span> : <span className="muted">See source reading for context</span>}</li>;
  })}</ul> : <p className="unknown-copy">{category === 'needs' ? 'Unknown. Romantic needs are not inferred from public career or lifestyle information.' : 'No explicit evidence found in these sources.'}</p>}</section>;
}
function displayPost(post) { return typeof post === 'string' ? post : post.caption || post.text || ''; }
function SourceSnapshot({ source, snapshot, url }) {
  const isLinkedin = source === 'linkedin';
  return <article className="snapshot"><div className="snapshot-header"><h3>{isLinkedin ? 'LinkedIn' : 'Instagram'}</h3><a href={url} target="_blank" rel="noopener noreferrer">Open profile <ExternalLink size={14} /></a></div><p className="snapshot-time">Retrieved {formatTimestamp(snapshot?.fetchedAt)}{!isLinkedin && snapshot?.public === true ? ' · Public profile' : ''}</p>{snapshot ? <><div className="source-quote"><Quote size={18} /><p>{isLinkedin ? snapshot.headline || snapshot.about || 'No headline returned.' : snapshot.bio || 'No bio returned.'}</p></div>{isLinkedin && snapshot.about && <div className="source-text"><strong>About</strong><p>{snapshot.about}</p></div>}{isLinkedin && !!snapshot.experience?.length && <div className="source-text"><strong>Experience</strong><ul>{snapshot.experience.map((item, i) => <li key={i}>{typeof item === 'string' ? item : [item.title, typeof item.company === 'object' ? item.company.name : item.company, item.period].filter(Boolean).join(' · ')}</li>)}</ul></div>}{isLinkedin && !!snapshot.skills?.length && <div className="source-text"><strong>Skills</strong><div className="topic-chips">{snapshot.skills.map((item, i) => <span key={i}>{typeof item === 'string' ? item : item.name || 'Skill'}</span>)}</div></div>}{!isLinkedin && <div className="source-text"><strong>Recent post captions</strong>{snapshot.recentPosts?.length ? <ol className="post-captions">{snapshot.recentPosts.map((post, i) => <li key={i}><p>{displayPost(post) || 'No caption returned.'}</p>{(post.url || snapshot.postUrls?.[i]) && <a href={post.url || snapshot.postUrls?.[i]} target="_blank" rel="noopener noreferrer">View source post <ExternalLink size={12} /></a>}</li>)}</ol> : <p>No public post captions returned.</p>}</div>}<details className="raw-details"><summary>Inspect full source snapshot</summary><pre>{JSON.stringify(snapshot, null, 2)}</pre></details></> : <p>No source snapshot available.</p>}</article>;
}
export function ProfileModal({ personId, onClose, onLaunchDate, onOpenRankings }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [tab, setTab] = useState('analysis'); const [retry, setRetry] = useState(0);
  const [activeClaim, setActiveClaim] = useState('');
  useEffect(() => {
    if (tab === 'claims' && activeClaim) {
      const element = document.getElementById(`claim-${activeClaim}`);
      element?.scrollIntoView({ block: 'center' });
      element?.focus({ preventScroll: true });
    }
  }, [tab, activeClaim]);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    api.getPerson(personId, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); }).catch(err => { if (err.name !== 'AbortError') setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [personId, retry]);
  const person = data?.person; const analysis = person?.analysis || {};
  const date = () => { onClose(); onLaunchDate(person.id, data.rankings?.[0]?.id); };
  return <Dialog wide title={person?.name || 'Reading a person'} subtitle="An agent briefing grounded in two public sources." onClose={onClose} busy={loading}>
    {loading ? <Loading>Opening the analysis and source evidence…</Loading> : error ? <ErrorNotice message={error} onRetry={() => setRetry(r => r + 1)} /> : person && <>
      <div className="profile-intro"><Avatar name={person.name} large /><div><span className="eyebrow">{analysis.archetype || 'EVIDENCE-LED AGENT'}</span><h3>{person.role || 'Public profile'}</h3><SourceLinks person={person} /></div><div className="profile-intro-actions"><button type="button" className="btn btn-primary btn-small" onClick={date}>Choose a date <ArrowRight size={15} /></button><button type="button" className="text-button" onClick={() => { onClose(); onOpenRankings(person.id); }}>View rankings <ArrowRight size={14} /></button></div></div>
      <div className="provenance-note"><span className="eyebrow">TWO PUBLIC SOURCES · IDENTITY STATUS</span><p>{person.provenance?.identityNote || 'Account ownership and participation are not independently verified.'}</p><span>LinkedIn retrieved {formatTimestamp(person.scrapedData?.linkedin?.fetchedAt)} · Instagram retrieved {formatTimestamp(person.scrapedData?.instagram?.fetchedAt)}</span></div><nav className="profile-tabs" aria-label="Profile sections"><button type="button" onClick={() => setTab('analysis')} aria-current={tab === 'analysis' ? 'page' : undefined} className={tab === 'analysis' ? 'active' : ''}>Agent analysis</button><button type="button" onClick={() => setTab('sources')} aria-current={tab === 'sources' ? 'page' : undefined} className={tab === 'sources' ? 'active' : ''}>Read the two sources</button><button type="button" onClick={() => setTab('claims')} aria-current={tab === 'claims' ? 'page' : undefined} className={tab === 'claims' ? 'active' : ''}>Evidence ledger <span>{analysis.claims?.length || 0}</span></button></nav>
      {tab === 'analysis' && <><div className="agent-brief"><span className="eyebrow"><FileText size={14} /> AGENT BRIEFING</span><p>{analysis.summary || 'No summary is available for these sources.'}</p><span className="label label-sage">{analysis.claims?.length || 0} observed claims</span></div><div className="analysis-grid">{categories.map(([category, title, Icon]) => <EvidenceList key={category} analysis={analysis} category={category} title={title} Icon={Icon} onClaim={id => { setActiveClaim(id); setTab('claims'); }} />)}</div><div className="unknown-panel"><span className="eyebrow">WHAT THE AGENT DOESN’T KNOW</span><ul>{(analysis.unknowns?.length ? analysis.unknowns : ['Relationship status, romantic preferences, availability and private needs are unknown.']).map((item, i) => <li key={i}>{item}</li>)}</ul></div><div className="method-note"><strong>Conversation brief</strong><p>{analysis.datingStyle || 'Discuss explicit public topics, cite source evidence, and ask about unknowns without claiming to know private preferences.'}</p></div></>}
      {tab === 'sources' && <div className="snapshot-grid"><SourceSnapshot source="linkedin" snapshot={person.scrapedData?.linkedin} url={person.linkedinUrl} /><SourceSnapshot source="instagram" snapshot={person.scrapedData?.instagram} url={person.instagramUrl} /></div>}
      {tab === 'claims' && <div className="claims-ledger"><p className="muted">Each observed topic is attached to its original source. The agent only receives these two profiles.</p>{analysis.claims?.length ? analysis.claims.map(claim => <article className="claim-row" key={claim.id} tabIndex={-1} id={`claim-${claim.id}`}><div><span className="claim-id">{claim.id}</span><span className="label label-sage">{claim.confidence || 'observed'}</span></div><div><h4>{claim.label}</h4><p>{claim.excerpt || 'No excerpt returned.'}</p><span className="muted">{claim.category} · {claim.field}</span></div><a href={claim.url} target="_blank" rel="noopener noreferrer">{claim.source}<ExternalLink size={13} /></a></article>) : <p>No explicit claims were extracted.</p>}</div>}
      <p className="fine-print">This simulated agent represents public-source evidence. It does not speak for the person’s actual intentions.</p>
    </>}
  </Dialog>;
}



