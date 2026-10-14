import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Link2, ScanText, Check, LoaderCircle } from 'lucide-react';
import { api } from '../services/api';
import { Dialog, ErrorNotice } from './UI';

function validateProfile(value, source) {
  let url;
  try { url = new URL(value); } catch { return `Enter a complete ${source} profile URL.`; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (url.protocol !== 'https:' || url.username || url.password) return 'Use a secure HTTPS profile link.';
  if (source === 'LinkedIn' && (!/^(?:[a-z]{2}\.)?linkedin\.com$/.test(host) || !/^\/in\/[^/]+\/?$/.test(url.pathname))) return 'Use a LinkedIn person profile: https://www.linkedin.com/in/name/';
  if (source === 'Instagram' && (host !== 'instagram.com' || !/^\/[A-Za-z0-9_.]+\/?$/.test(url.pathname) || /^\/(p|reel|reels|stories|explore|accounts)\/?$/.test(url.pathname))) return 'Use an Instagram profile link, rather than a post or reel.';
  return '';
}
export function AddPersonModal({ onClose, onSuccess }) {
  const [name, setName] = useState(''); const [linkedinUrl, setLinkedinUrl] = useState(''); const [instagramUrl, setInstagramUrl] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    const validation = validateProfile(linkedinUrl.trim(), 'LinkedIn') || validateProfile(instagramUrl.trim(), 'Instagram');
    if (validation) { setError(validation); return; }
    setBusy(true); setError(''); controller.current = new AbortController();
    try {
      const data = await api.ingestPerson({ name: name.trim() || undefined, linkedinUrl: linkedinUrl.trim(), instagramUrl: instagramUrl.trim() }, controller.current.signal);
      if (!data.person?.id) throw new Error('The import did not return a person. Please try again.');
      await onSuccess(data.person);
    } catch (err) { if (err.name !== 'AbortError') { setError(err.message); setBusy(false); } }
  };
  const close = () => { controller.current?.abort(); onClose(); };
  const example = () => { setName('Ali Abdaal'); setLinkedinUrl('https://www.linkedin.com/in/aliabdaal/'); setInstagramUrl('https://www.instagram.com/aliabdaal/'); setError(''); };
  return <Dialog title="A person. Two public profiles." subtitle="Let their agent start with evidence." onClose={close} busy={busy}>
    <div className="import-steps"><span className="active"><Link2 size={16} />Connect</span><span><ScanText size={16} />Read</span><span><Check size={16} />Review profile</span></div>
    <form onSubmit={submit} className="stack-form">
      <label>Name <span className="optional">optional</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Their full name" disabled={busy} maxLength={120} /></label>
      <label>LinkedIn profile<input type="url" required value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" disabled={busy} autoComplete="off" /></label>
      <label>Public Instagram profile<input type="url" required value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://www.instagram.com/…" disabled={busy} autoComplete="off" /></label>
      <p className="form-note">Use profiles belonging to the same person. Private Instagram accounts cannot be imported.</p>
      {error && <ErrorNotice message={error} />}
      {busy && <div className="import-wait" role="status"><LoaderCircle className="spinner" size={22} /><div><strong>Reading the two source profiles…</strong><p>Public source retrieval can take up to three minutes. The analysis will open when both sources are ready.</p><small>Closing this dialog cancels waiting; the server may still finish its current retrieval.</small></div></div>}
      <button className="btn btn-primary full-width" disabled={busy} type="submit">{busy ? 'Waiting for sources' : 'Read profiles & create agent'}{!busy && <ArrowRight size={17} />}</button>
      <button className="text-button example-button" type="button" onClick={example} disabled={busy}>Use Ali Abdaal’s source links <ArrowRight size={15} /></button>
    </form>
    <p className="fine-print">Agents simulate public-topic conversations. A profile import does not establish the person’s participation or romantic preferences.</p>
  </Dialog>;
}

