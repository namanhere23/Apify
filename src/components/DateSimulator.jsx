import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Play, Pause, RotateCcw, StepForward, ChevronsRight, Download, MessagesSquare, MapPin, FileText } from 'lucide-react';
import { api, downloadJSON } from '../services/api';
import { Avatar, EmptyState, ErrorNotice, Loading, ScoreBreakdown, formatTimestamp } from './UI';

export function DateSimulator({ people, initialPersonAId, initialPersonBId, initialDateId, onOpenIngest, onOpenProfile, onDateSaved }) {
  const [personAId, setPersonAId] = useState(initialPersonAId || people[0]?.id || '');
  const [personBId, setPersonBId] = useState(initialPersonBId || people.find(p => p.id !== (initialPersonAId || people[0]?.id))?.id || '');
  const [session, setSession] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(0); const [playing, setPlaying] = useState(false); const [speed, setSpeed] = useState(3000);
  const controller = useRef(null); const stream = useRef(null); const savedCallback = useRef(onDateSaved); savedCallback.current = onDateSaved;
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const first = initialPersonAId || people[0]?.id || '';
    const second = initialPersonBId && initialPersonBId !== first ? initialPersonBId : people.find(p => p.id !== first)?.id || '';
    setPersonAId(first); setPersonBId(second); setSession(null); setVisibleCount(0); setPlaying(false); setError(''); setLoading(false); controller.current?.abort();
  }, [initialPersonAId, initialPersonBId, people]);
  const loadSession = useCallback(async (request, saved = false) => {
    controller.current?.abort(); const nextController = new AbortController(); controller.current = nextController;
    setLoading(true); setError(''); setSession(null); setVisibleCount(0); setPlaying(false);
    try {
      const data = await request(nextController.signal);
      if (nextController.signal.aborted) return;
      if (!data?.turns?.length) throw new Error('This session contains no agent conversation. Please try another pair.');
      setSession(data); setVisibleCount(1); setPlaying(true);
      if (saved) savedCallback.current?.();
    } catch (err) { if (err.name !== 'AbortError' && !nextController.signal.aborted) setError(err.message); }
    finally { if (!nextController.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (initialDateId) loadSession(signal => api.getDate(initialDateId, signal));
  }, [initialDateId, loadSession]);
  const total = session?.turns?.length || 0; const complete = total > 0 && visibleCount >= total;
  useEffect(() => {
    if (!playing || !session || complete || loading) return;
    const timer = setTimeout(() => setVisibleCount(count => Math.min(count + 1, total)), speed);
    return () => clearTimeout(timer);
  }, [playing, session, complete, loading, visibleCount, total, speed]);
  useEffect(() => { if (complete) setPlaying(false); }, [complete]);
  useEffect(() => { if (stream.current) stream.current.scrollTop = stream.current.scrollHeight; }, [visibleCount]);
  const reset = () => { controller.current?.abort(); setSession(null); setLoading(false); setError(''); setVisibleCount(0); setPlaying(false); };
  const selectA = id => { reset(); setPersonAId(id); if (personBId === id) setPersonBId(people.find(p => p.id !== id)?.id || ''); };
  const selectB = id => { reset(); setPersonBId(id); };
  const personA = people.find(p => p.id === personAId); const personB = people.find(p => p.id === personBId);
  const displayA = session?.personA || personA; const displayB = session?.personB || personB;
  const start = () => { if (personAId && personBId && personAId !== personBId) loadSession(signal => api.simulateDate(personAId, personBId, signal), true); };
  const findClaim = id => {
    const separator = id.lastIndexOf(':');
    const ownerId = separator >= 0 ? id.slice(0, separator) : '';
    const claimId = separator >= 0 ? id.slice(separator + 1) : id;
    for (const person of [session?.personA, session?.personB, ...people]) {
      if (ownerId && person?.id !== ownerId) continue;
      const claim = person?.analysis?.claims?.find(claim => claim.id === claimId); if (claim) return { ...claim, personName: person.name, personId: person.id };
    }
    return null;
  };
  if (people.length < 2) return <section className="page-width studio-page"><EmptyState eyebrow="THE DATE STUDIO" title="A conversation takes two agents." action={<button className="btn btn-primary" onClick={onOpenIngest}>Add a person <ArrowRight size={16} /></button>}>There {people.length === 1 ? 'is one person' : 'are no people'} in the studio. Add two pairs of public profile links to start an agent date.</EmptyState></section>;
  return <section className="page-width studio-page"><div className="section-heading"><div><span className="eyebrow">AUTONOMOUS CONVERSATIONS · VISIBLE REASONING</span><h1 className="page-title">The date studio.</h1><p>Watch two agents meet. Inspect their evidence, decisions, and debrief.</p></div><span className="label label-sage">Rule-based simulation</span></div>
    <div className="pair-selector"><div className="agent-select"><Avatar name={personA?.name} /><label>AGENT ONE<select aria-label="First agent" value={personAId} onChange={e => selectA(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><MessagesSquare className="pair-icon" size={26} strokeWidth={1.3} /><div className="agent-select"><Avatar name={personB?.name} tone="sage" /><label>AGENT TWO<select aria-label="Second agent" value={personBId} onChange={e => selectB(e.target.value)}>{people.filter(p => p.id !== personAId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><button className="btn btn-primary" onClick={start} disabled={loading || !personAId || !personBId || personAId === personBId}>{loading ? 'Preparing session…' : session ? 'Run selected pair' : 'Start agent date'}<ArrowRight size={16} /></button></div>
    {error && <ErrorNotice message={error} onRetry={initialDateId ? () => loadSession(signal => api.getDate(initialDateId, signal)) : start} />}
    {loading ? <Loading>Building and saving an evidence-led conversation…</Loading> : !session ? <div className="studio-welcome"><span className="studio-illustration"><MessagesSquare size={52} strokeWidth={1} /></span><span className="eyebrow">THEIR SOURCES SET THE SCENE</span><h2>A first meeting,<br /><em>with the evidence in view.</em></h2><p>Select two agents and start a date. You will see each turn, the source claims behind it, and what each agent takes away.</p><div className="welcome-pair"><span>{personA?.name}</span><span>+</span><span>{personB?.name}</span></div></div> : <div className="studio-grid"><div className="conversation-column"><div className="venue-heading"><MapPin size={18} /><div><strong>{session.venue?.name || 'A simulated first meeting'}</strong><p>{session.venue?.atmosphere}</p></div><span className="label">{complete ? 'Date complete' : playing ? 'Playing transcript' : 'Paused'}</span></div>
      <div className="conversation-stream" ref={stream} aria-label="Agent conversation"><div className="conversation-start"><span className="eyebrow">{displayA?.name} & {displayB?.name}</span><p>A simulated conversation grounded in public source evidence.</p></div>{session.turns.slice(0, visibleCount).map((turn, index) => {
        const isA = turn.speakerId === (session.personA?.id || personAId);
        return <article className={`conversation-turn ${isA ? 'turn-a' : 'turn-b'}`} key={`${session.dateId}-${index}`}><Avatar name={turn.speaker || (isA ? displayA?.name : displayB?.name)} tone={isA ? 'rose' : 'sage'} /><div className="turn-content"><div className="turn-meta"><strong>{people.find(p => p.id === turn.speakerId)?.name || (isA ? displayA?.name : displayB?.name)}’s agent</strong><span>{turn.phase || 'Conversation'} · {turn.turn || index + 1}</span></div><p className="turn-text">{turn.text}</p><div className="turn-evidence">{(turn.evidenceIds || []).map(id => { const claim = findClaim(id); return claim?.url ? <a key={id} href={claim.url} title={claim.excerpt} target="_blank" rel="noopener noreferrer"><FileText size={11} />{claim.personName?.split(' ')[0]} · {claim.source} · {claim.id}</a> : <button key={id} onClick={() => onOpenProfile(turn.speakerId)}><FileText size={11} />{id}</button>; })}</div>{turn.innerMonologue && <details className="turn-trace"><summary>Agent decision & memory trace</summary><p>{turn.innerMonologue}</p>{turn.memory && <pre>{JSON.stringify(turn.memory, null, 2)}</pre>}</details>}</div></article>;
      })}{complete && <div className="conversation-end"><span className="status-dot status-online" /> Conversation complete · both agents have written a debrief</div>}</div>
      <div className="playback-controls"><div><button className="btn btn-primary btn-small" disabled={complete} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Resume'}</button><button className="icon-button" disabled={complete} onClick={() => { setPlaying(false); setVisibleCount(count => Math.min(count + 1, total)); }} aria-label="Next turn"><StepForward size={18} /></button><button className="icon-button" onClick={() => { setVisibleCount(1); setPlaying(true); }} aria-label="Replay date"><RotateCcw size={17} /></button></div><span className="turn-count" aria-live="polite">{visibleCount} / {total} turns</span><button className="text-button" disabled={complete} onClick={() => { setPlaying(false); setVisibleCount(total); }}>Reveal all <ChevronsRight size={17} /></button></div><div className="transcript-toolbar"><label>Playback pace<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Playback pace"><option value={1500}>Quick · 1.5s</option><option value={3000}>Standard · 3s</option><option value={6000}>Read · 6s</option></select></label><button className="text-button" onClick={() => downloadJSON(session, `aura-date-${session.dateId}.json`)}><Download size={15} />Transcript JSON</button></div>
    </div><aside className="date-report"><div className="session-metadata"><span className="eyebrow">SESSION RECORD</span><strong>{session.dateId}</strong><p>{formatTimestamp(session.createdAt)}</p><p>Two agents · {total} turns · {session.mode || 'rule-based'}</p></div>{complete ? <><div className="final-score"><span className="eyebrow">PUBLIC-TOPIC CONVERSATION FIT</span><strong>{session.compatibility?.compositeScore ?? '—'}<small>/100</small></strong><span className="label label-sage">{session.compatibility?.badge || 'Conversation fit'}</span><p>{session.compatibility?.verdict}</p></div><ScoreBreakdown breakdown={session.compatibility?.breakdown} /><div className="agent-debriefs"><span className="eyebrow">AFTER THE DATE</span>{(session.debriefs || []).map(debrief => <article key={debrief.personId}><h3>{debrief.name}’s agent</h3><strong>{debrief.decision}</strong><ul>{debrief.reasons?.map((reason, i) => <li key={i}>{reason}</li>)}</ul>{!!debrief.openQuestions?.length && <details><summary>Questions still open</summary><ul>{debrief.openQuestions.map((question, i) => <li key={i}>{question}</li>)}</ul></details>}</article>)}</div></> : <div className="report-pending"><MessagesSquare size={29} strokeWidth={1.4} /><h3>Let the conversation unfold.</h3><p>The final score, component breakdown and both agent debriefs appear after the last turn.</p></div>}<p className="fine-print">{session.disclaimer || 'This is a simulation of public-topic conversation fit. Public profiles do not establish romantic preferences or real participation.'}</p></aside></div>}
  </section>;
}


