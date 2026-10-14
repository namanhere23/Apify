import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, CheckCircle2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { Dialog, ErrorNotice } from './UI';
export function ApiKeyModal({ onClose, apifyActive, onUpdateStatus }) {
  const [token, setToken] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  const controller = useRef(null); useEffect(() => () => controller.current?.abort(), []);
  const save = async event => {
    event.preventDefault(); if (busy || !token.trim()) return;
    setBusy(true); setError(''); setSaved(false); controller.current = new AbortController();
    try {
      const result = await api.updateSettings(token.trim(), controller.current.signal);
      if (!result.success) throw new Error(result.error || 'The connection could not be saved.');
      setToken(''); setSaved(true); onUpdateStatus(Boolean(result.apifyConfigured));
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); } finally { if (!controller.current.signal.aborted) setBusy(false); }
  };
  return <Dialog title="Connect your sources" subtitle="Configure public profile retrieval." onClose={onClose} busy={busy}>
    <div className="settings-status"><KeyRound size={23} /><div><strong>Apify {apifyActive ? 'is connected' : 'is not configured'}</strong><p>{apifyActive ? 'New profile pairs can be retrieved through the configured public source actors.' : 'Saved profiles remain available. Connect Apify to read new profile pairs.'}</p></div></div>
    <form className="stack-form" onSubmit={save}><label>Apify API token<input type="password" value={token} onChange={e => setToken(e.target.value)} required placeholder="apify_api_…" autoComplete="off" disabled={busy} /></label><p className="form-note">The token is sent to the server. It is never saved in browser storage or included in profile exports.</p>{error && <ErrorNotice message={error} />}{saved && <div className="success-notice" role="status"><CheckCircle2 size={18} />Connection saved.</div>}<button type="submit" className="btn btn-primary full-width" disabled={busy || !token.trim()}>{busy ? 'Saving connection…' : 'Save connection'}<ArrowRight size={16} /></button></form>
    <div className="method-note"><span className="eyebrow">THE AGENT ENGINE</span><p>Evidence-led, rule-based conversations and scoring. Each agent’s turns and debrief can be inspected in the date studio.</p></div>
  </Dialog>;
}


