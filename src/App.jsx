import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { PeopleDirectory } from './components/PeopleDirectory';
import { ProfileModal } from './components/ProfileModal';
import { DateSimulator } from './components/DateSimulator';
import { RankingMatrix } from './components/RankingMatrix';
import { AddPersonModal } from './components/AddPersonModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ErrorNotice, Loading } from './components/UI';
import { api, downloadJSON } from './services/api';
import { Asterisk, Download } from 'lucide-react';

export function App() {
  const [people, setPeople] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('directory'); const [status, setStatus] = useState(null);
  const [inspectPersonId, setInspectPersonId] = useState(() => new URLSearchParams(window.location.search).get('profile')); const [isIngestOpen, setIsIngestOpen] = useState(false); const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [simulatorPair, setSimulatorPair] = useState({ personAId: '', personBId: '', dateId: '' }); const [rankingPersonId, setRankingPersonId] = useState('');
  const [exporting, setExporting] = useState(false); const [exportError, setExportError] = useState('');
  const load = useCallback(async signal => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([api.getPeople(signal), api.getStatus(signal)]);
    if (signal?.aborted) return;
    if (results[0].status === 'fulfilled') setPeople(results[0].value || []); else if (results[0].reason.name !== 'AbortError') setError(results[0].reason.message);
    if (results[1].status === 'fulfilled') setStatus(results[1].value);
    setLoading(false);
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (inspectPersonId) url.searchParams.set('profile', inspectPersonId); else url.searchParams.delete('profile');
    window.history.replaceState(window.history.state, '', url);
  }, [inspectPersonId]);
  useEffect(() => {
    const readUrl = () => setInspectPersonId(new URLSearchParams(window.location.search).get('profile'));
    window.addEventListener('popstate', readUrl);
    return () => window.removeEventListener('popstate', readUrl);
  }, []);
  const handleDatePerson = (targetPersonId, partnerPersonId, dateId = '') => {
    const person = people.find(p => p.id === targetPersonId);
    const preferred = partnerPersonId || person?.topMatch?.id;
    const validPartner = people.some(p => p.id === preferred && p.id !== targetPersonId) ? preferred : people.find(p => p.id !== targetPersonId)?.id || '';
    setSimulatorPair({ personAId: targetPersonId || people[0]?.id || '', personBId: validPartner, dateId }); setActiveTab('simulator'); window.scrollTo(0, 0);
  };
  const handleIngestSuccess = async person => {
    setIsIngestOpen(false); setInspectPersonId(person.id);
    try { const normalized = await api.getPeople(); setPeople(normalized || []); setStatus(await api.getStatus()); } catch (err) { setError(err.message); }
  };
  const openRankings = personId => { setRankingPersonId(personId); setActiveTab('rankings'); window.scrollTo(0, 0); };
  const dateSaved = useCallback(() => { api.getStatus().then(setStatus).catch(() => {}); }, []);
  const exportProject = async () => {
    setExporting(true); setExportError('');
    try { downloadJSON(await api.getExport(), 'aura-studio-export.json'); } catch (err) { setExportError(err.message); } finally { setExporting(false); }
  };
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><Navbar activeTab={activeTab} setActiveTab={setActiveTab} onOpenIngest={() => setIsIngestOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} peopleCount={people.length} apifyActive={status?.apifyConfigured} /><main id="main-content">
    {error && <div className="page-width global-error"><ErrorNotice message={error} onRetry={() => load()} /></div>}
    {activeTab === 'directory' && <><Hero people={people} peopleCount={people.length} dateCount={status?.dateCount} onExploreAgents={() => document.getElementById('people-directory')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} onWatchFeaturedDate={() => people.length >= 2 ? handleDatePerson(people[0].id) : setIsIngestOpen(true)} onOpenIngest={() => setIsIngestOpen(true)} />{loading ? <div className="page-width"><Loading>Reading the saved studio…</Loading></div> : <PeopleDirectory people={people} onSelectPerson={setInspectPersonId} onDatePerson={handleDatePerson} onOpenIngest={() => setIsIngestOpen(true)} />}</>}
    {activeTab === 'simulator' && <DateSimulator people={people} initialPersonAId={simulatorPair.personAId} initialPersonBId={simulatorPair.personBId} initialDateId={simulatorPair.dateId} onOpenIngest={() => setIsIngestOpen(true)} onOpenProfile={setInspectPersonId} onDateSaved={dateSaved} />}
    {activeTab === 'rankings' && <RankingMatrix people={people} initialPersonId={rankingPersonId} onSelectPersonForDate={handleDatePerson} onOpenDate={(dateId, a, b) => handleDatePerson(a, b, dateId)} onOpenProfile={setInspectPersonId} onOpenIngest={() => setIsIngestOpen(true)} />}
  </main><footer className="site-footer page-width"><div className="footer-brand"><Asterisk size={20} /> AURA <span>People, through the lens of their agents.</span></div><p>Rule-based agent dates · LinkedIn + public Instagram only<br />Public-topic fit, with uncertainty kept visible.</p><button className="text-button" onClick={exportProject} disabled={exporting}><Download size={15} />{exporting ? 'Exporting…' : 'Export studio data'}</button>{exportError && <ErrorNotice message={exportError} />}</footer>
  {inspectPersonId && <ProfileModal personId={inspectPersonId} onClose={() => setInspectPersonId(null)} onLaunchDate={handleDatePerson} onOpenRankings={openRankings} />}
  {isIngestOpen && <AddPersonModal onClose={() => setIsIngestOpen(false)} onSuccess={handleIngestSuccess} />}
  {isSettingsOpen && <ApiKeyModal apifyActive={status?.apifyConfigured} onClose={() => setIsSettingsOpen(false)} onUpdateStatus={apifyConfigured => setStatus(current => ({ ...current, apifyConfigured }))} />}
  </div>;
}
export default App;

