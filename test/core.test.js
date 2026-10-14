import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ApifyScraper, normalizeProfileUrl } from '../server/apifyScraper.js';
import { createPerson, namesMatch } from '../server/personFactory.js';
import { DatingSimulationEngine } from '../server/simulationEngine.js';
import { Store } from '../server/store.js';
import { createApp } from '../server/index.js';

// Entirely fictional fixtures: tests never invent source facts for real people.
function person(name, handle, about, bio) {
  return createPerson({ fullName: name, handle, url: `https://www.linkedin.com/in/${handle}/`, fetchedAt: '2026-10-14T00:00:00Z', headline: about, about, experience: [], skills: [], education: [] }, { fullName: name, handle, url: `https://www.instagram.com/${handle}/`, fetchedAt: '2026-10-14T00:00:00Z', public: true, bio, recentPosts: [] });
}
const fixtures = () => [person('Test Person Alpha', 'test_alpha', 'Software developer, design and education', 'Hiking, books, music'), person('Test Person Beta', 'test_beta', 'Designer and writer', 'Hiking and photography'), person('Test Person Gamma', 'test_gamma', 'Investing and marketing', 'Cooking and tennis')];

test('URL allowlist prevents arbitrary domains, credential URLs and non-profile paths', () => {
  assert.equal(normalizeProfileUrl('https://uk.linkedin.com/in/Some-Person/?trk=foo', 'linkedin'), 'https://www.linkedin.com/in/some-person/');
  for (const url of ['http://www.linkedin.com/in/person', 'https://linkedin.com.evil.com/in/person', 'https://user:secret@linkedin.com/in/person', 'https://localhost/in/person', 'https://www.linkedin.com/company/test']) assert.throws(() => normalizeProfileUrl(url, 'linkedin'));
  for (const url of ['https://www.instagram.com/p/123/', 'https://www.instagram.com/accounts/', 'https://instagram.com:9999/person/']) assert.throws(() => normalizeProfileUrl(url, 'instagram'));
});
test('normalization rejects private, unconfirmed and wrong-identity Instagram accounts', () => {
  const scraper = new ApifyScraper();
  for (const item of [{ username: 'abc', isPrivate: true }, { username: 'abc' }, { username: 'other', isPrivate: false }, { error: 'not found' }]) assert.throws(() => scraper.formatInstagramData(item, 'https://www.instagram.com/abc/', 'abc'));
  const data = scraper.formatInstagramData({ username: 'abc', private: false, fullName: 'Test Example' }, 'https://www.instagram.com/abc/', 'abc');
  assert.equal(data.public, true); assert.deepEqual(data.recentPosts, []); assert.equal(data.bio, '');
});
test('missing source configuration never synthesizes a profile', async () => {
  const scraper = new ApifyScraper(); scraper.setToken(null);
  await assert.rejects(() => scraper.scrapeLinkedIn('https://www.linkedin.com/in/test-person/'), error => error.code === 'NOT_CONFIGURED');
  await assert.rejects(() => scraper.scrapeInstagram('https://www.instagram.com/test_person/'), error => error.code === 'NOT_CONFIGURED');
});
test('two sources must name the same person', () => {
  assert.equal(namesMatch('Test Example', 'Test Example | Writer'), true);
  assert.equal(namesMatch('Test Example', 'Different Person'), false);
  assert.equal(namesMatch('Test Example', ''), false);
  const sample = fixtures()[0];
  assert.throws(() => createPerson(sample.scrapedData.linkedin, { ...sample.scrapedData.instagram, fullName: 'Different Person' }));
});
test('analysis is deterministic, evidenced, and leaves unknown needs unknown', () => {
  const a = fixtures()[0], b = person(a.name, a.linkedinHandle, 'Software developer, design and education', 'Hiking, books, music');
  assert.deepEqual(a.analysis, b.analysis);
  assert.ok(a.analysis.hobbies.includes('Hiking'));
  assert.ok(!a.analysis.hobbies.includes('Food & cooking'));
  assert.match(a.analysis.needs[0], /unknown/);
  for (const claim of a.analysis.claims) assert.ok(claim.excerpt && [a.linkedinUrl, a.instagramUrl].includes(claim.url));
  assert.equal(a.analysis.vector, undefined);
});
test('every date has two independent evaluations and persistent evidence-aware memory', () => {
  const [a, b] = fixtures(), engine = new DatingSimulationEngine();
  const date = engine.simulateDate(a, b), reversed = engine.simulateDate(b, a);
  assert.equal(date.dateId, reversed.dateId); assert.deepEqual(date.turns, reversed.turns);
  assert.equal(date.turns.length, 10); assert.equal(date.debriefs.length, 2);
  assert.ok(date.turns.slice(3).some(t => t.memory.heardTopics.length > 0));
  assert.ok(date.turns.filter(t => t.intent === 'decision')[0].text.includes(date.venue.name));
  assert.ok(date.debriefs.every(d => d.score >= 0 && d.score <= 100 && d.openQuestions.length));
  const ids = new Set([a, b].flatMap(p => p.analysis.claims.map(c => `${p.id}:${c.id}`)));
  assert.ok(date.turns.every(t => t.evidenceIds.every(id => ids.has(id))));
});
test('rankings are complete, stable and use the target agent’s date evaluation', () => {
  const people = fixtures(), engine = new DatingSimulationEngine();
  const ranking = engine.generateRankingsForPerson(people[0], people);
  assert.equal(ranking.length, 2); assert.ok(ranking.every(r => r.id !== people[0].id));
  assert.deepEqual(ranking, engine.generateRankingsForPerson(people[0], people));
  assert.ok(ranking[0].score >= ranking[1].score);
  for (const row of ranking) assert.equal(row.score, engine.simulateDate(people[0], people.find(p => p.id === row.id)).debriefs.find(d => d.personId === people[0].id).score);
});
test('store survives restart and deduplicates concurrent source imports', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aura-store-test-'));
  try {
    const store = await new Store(directory).load(), people = fixtures();
    await Promise.all([store.add(people[0]), store.add(people[0]), store.add(people[1])]);
    const restored = await new Store(directory).load();
    assert.equal(restored.people.length, 2); assert.equal(Object.keys(restored.dates).length, 1);
    assert.deepEqual(restored.export(), JSON.parse(await readFile(path.join(directory, 'state.json'), 'utf8')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('API surfaces failures, caches valid imports and rejects unsafe mutations', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aura-api-test-'));
  const store = await new Store(directory).load();
  const [a, b] = fixtures(); await store.add(a); await store.add(b);
  const fakeScraper = { token: null, setToken(value) { this.token = value; }, async scrapeLinkedIn() { throw new Error('unreachable'); }, async scrapeInstagram() { throw new Error('unreachable'); } };
  const server = createApp(store, fakeScraper).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/api/people/missing')).status, 404);
    assert.equal((await post('/api/date', { personAId: a.id, personBId: a.id })).status, 400);
    assert.equal((await post('/api/reset', {})).status, 400);
    assert.equal((await post('/api/settings', { apifyToken: 'test-token' }, { Origin: 'https://attacker.example' })).status, 403);
    const cached = await (await post('/api/ingest', { linkedinUrl: a.linkedinUrl, instagramUrl: a.instagramUrl })).json();
    assert.equal(cached.cached, true); assert.equal(cached.person.id, a.id);
    assert.equal((await post('/api/ingest', { linkedinUrl: a.linkedinUrl, instagramUrl: b.instagramUrl })).status, 409);
    const date = await (await post('/api/date', { personAId: a.id, personBId: b.id })).json();
    assert.equal((await fetch(base + '/api/dates/' + date.dateId)).status, 200);
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
    const failed = await post('/api/ingest', { linkedinUrl: 'https://www.linkedin.com/in/test-new/', instagramUrl: 'https://www.instagram.com/test-new/' });
    assert.equal(failed.status, 400); // Instagram hyphens are invalid, so provider never runs.
    const sourceFailure = await post('/api/ingest', { linkedinUrl: 'https://www.linkedin.com/in/test-new/', instagramUrl: 'https://www.instagram.com/test_new/' });
    assert.equal(sourceFailure.status, 500); assert.equal(store.people.length, 2);
    assert.equal(JSON.stringify(await (await fetch(base + '/api/status')).json()).includes('test-token'), false);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
