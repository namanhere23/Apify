import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ApifyScraper, SourceError, normalizeProfileUrl } from './apifyScraper.js';
import { createPerson } from './personFactory.js';
import { Store } from './store.js';

dotenv.config({ quiet: true });
const directory = path.dirname(fileURLToPath(import.meta.url));
export const methodology = 'Each pair completes a persisted ten-turn rule-based date. Each agent scores the counterpart on directional topic overlap (45), leisure overlap (30), dialogue outcome (15) and evidence coverage (10). Unsupported topic categories receive zero weight; remaining weights are normalized. Mutual fit is the mean of the two evaluations. These are conversation-fit indices, not romantic predictions.';

export function createApp(store, scraper = new ApifyScraper()) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    // No broad CORS. State-changing requests must come from this UI or the local Vite UI.
    if (['POST', 'DELETE', 'PUT', 'PATCH'].includes(req.method) && req.headers.origin) {
      const allowed = [`http://${req.headers.host}`, `https://${req.headers.host}`, 'http://localhost:5173', 'http://127.0.0.1:5173', process.env.APP_ORIGIN].filter(Boolean);
      if (!allowed.includes(req.headers.origin)) return res.status(403).json({ error: 'This origin cannot change the application.', code: 'ORIGIN_REJECTED' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  const personById = id => {
    const person = store.people.find(p => p.id === id);
    if (!person) throw new SourceError('Person not found.', 'NOT_FOUND', 404);
    return person;
  };
  app.get('/api/status', (req, res) => res.json({ status: 'online', version: '2.0.0', peopleCount: store.people.length, dateCount: Object.keys(store.dates).length, apifyConfigured: Boolean(scraper.token), llmConfigured: false, mode: 'rule-based', actors: { linkedin: 'harvestapi/linkedin-profile-scraper', instagram: 'apify/instagram-scraper' }, cohortStatus: store.people.length >= 25 ? '25-profile minimum reached; ownership remains unverified' : 'Below 25 profiles' }));
  app.post('/api/settings', async (req, res) => {
    const token = req.body?.apifyToken;
    if (typeof token !== 'string' || token.length > 500 || /\s/.test(token.trim())) throw new SourceError('Provide a valid token or an empty string to disconnect.', 'INVALID_TOKEN', 400);
    if (token.trim()) await new ApifyScraper(token.trim()).request('/users/me');
    scraper.setToken(token.trim() || null);
    res.json({ success: true, apifyConfigured: Boolean(scraper.token) });
  });
  app.get('/api/people', (req, res) => res.json({ total: store.people.length, people: store.people.map(person => {
    const top = store.rankings(person)[0];
    return { id: person.id, name: person.name, role: person.role, avatar: person.avatar, linkedinUrl: person.linkedinUrl, instagramUrl: person.instagramUrl, linkedinHandle: person.linkedinHandle, instagramHandle: person.instagramHandle, ...person.analysis, analysis: person.analysis, provenance: person.provenance, topMatch: top ? { id: top.id, name: top.name, score: top.score, badge: top.badge } : null };
  }) }));
  app.get('/api/people/:id', (req, res) => { const person = personById(req.params.id); res.json({ person, rankings: store.rankings(person) }); });
  app.get('/api/people/:id/rankings', (req, res) => {
    const person = personById(req.params.id), rankings = store.rankings(person);
    res.json({ personId: person.id, personName: person.name, totalSuitors: rankings.length, rankings, methodology });
  });
  app.get('/api/dates/:id', (req, res) => {
    const date = store.dates[req.params.id];
    if (!date) throw new SourceError('Date session not found.', 'NOT_FOUND', 404);
    res.json(date);
  });
  app.post('/api/date', async (req, res) => {
    const { personAId, personBId } = req.body || {};
    if (!personAId || !personBId) throw new SourceError('Select both agents.', 'MISSING_AGENTS', 400);
    if (personAId === personBId) throw new SourceError('Select two different agents.', 'SELF_DATE', 400);
    const a = personById(personAId), b = personById(personBId);
    const date = store.getDate(a, b); await store.save(); res.json(date);
  });
  const imports = new Map();
  app.post('/api/ingest', async (req, res) => {
    const linkedinUrl = normalizeProfileUrl(req.body?.linkedinUrl, 'linkedin');
    const instagramUrl = normalizeProfileUrl(req.body?.instagramUrl, 'instagram');
    const existing = store.people.find(p => p.linkedinUrl === linkedinUrl || p.instagramUrl === instagramUrl);
    if (existing && (existing.linkedinUrl !== linkedinUrl || existing.instagramUrl !== instagramUrl)) throw new SourceError('One of these profiles already belongs to a different source pair.', 'DUPLICATE_SOURCE', 409);
    if (existing) return res.json({ success: true, cached: true, person: existing, rankings: store.rankings(existing), message: 'Opened the saved two-source snapshot. Retrieval timestamps are shown on the profile.' });
    const key = `${linkedinUrl}|${instagramUrl}`;
    if (!imports.has(key)) {
      const promise = (async () => {
        const [linkedin, instagram] = await Promise.all([scraper.scrapeLinkedIn(linkedinUrl), scraper.scrapeInstagram(instagramUrl)]);
        return store.add(createPerson(linkedin, instagram));
      })();
      imports.set(key, promise);
      promise.finally(() => imports.delete(key)).catch(() => {});
    }
    const person = await imports.get(key);
    res.status(201).json({ success: true, cached: false, person, rankings: store.rankings(person), message: 'Both public sources were retrieved, names matched, analysis created, and cohort dates persisted.' });
  });
  app.get('/api/export', (req, res) => { res.attachment('aura-evidence-and-dates.json'); res.json({ ...store.export(), methodology }); });
  // Reset deliberately requires an explicit JSON command. The UI does not offer accidental cohort deletion.
  app.post('/api/reset', async (req, res) => {
    if (req.body?.confirm !== 'DELETE_ALL_PROFILES') throw new SourceError('Reset requires confirm: DELETE_ALL_PROFILES.', 'CONFIRM_REQUIRED', 400);
    if (imports.size) throw new SourceError('Wait for active imports before resetting the cohort.', 'IMPORT_ACTIVE', 409);
    store.people = []; store.dates = {}; await store.save(); res.json({ success: true, peopleCount: 0 });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.', code: 'NOT_FOUND' }));
  const dist = path.join(directory, '../dist');
  app.use(express.static(dist));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.type === 'entity.parse.failed' ? 400 : 500);
    res.status(status).json({ error: status === 500 ? 'The operation could not be saved. Check the server and retry.' : error.message, code: error.code || 'REQUEST_FAILED' });
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const store = await new Store(process.env.AURA_DATA_DIR || path.join(directory, 'data')).load();
  const port = Number(process.env.PORT) || 3001;
  createApp(store).listen(port, process.env.HOST || '127.0.0.1', () => console.log(`AURA: ${store.people.length} source-backed profiles, ${Object.keys(store.dates).length} saved agent dates. http://localhost:${port}`));
}
