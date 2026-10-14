/** Public retrieval. Missing data stays missing; retrieval never invents a profile. */
export class SourceError extends Error {
  constructor(message, code = 'SOURCE_FAILED', status = 502) { super(message); this.code = code; this.status = status; }
}
export function normalizeProfileUrl(value, platform) {
  if (typeof value !== 'string' || value.length > 500) throw new SourceError(`Provide a valid ${platform} profile URL.`, 'INVALID_URL', 400);
  let url;
  try { url = new URL(value.trim()); } catch { throw new SourceError(`Provide a valid ${platform} profile URL.`, 'INVALID_URL', 400); }
  const host = url.hostname.toLowerCase();
  const validHost = platform === 'linkedin' ? /^(?:www\.|[a-z]{2}\.)?linkedin\.com$/.test(host) : /^(?:www\.)?instagram\.com$/.test(host);
  const pattern = platform === 'linkedin' ? /^\/in\/([a-zA-Z0-9_%.-]+)\/?$/ : /^\/([a-zA-Z0-9_.]+)\/?$/;
  const match = url.pathname.match(pattern);
  if (!validHost || url.protocol !== 'https:' || url.username || url.password || url.port || !match || (platform === 'instagram' && ['p','reel','reels','stories','explore','accounts','direct','about'].includes(match[1].toLowerCase()))) throw new SourceError(`Use an official HTTPS ${platform} person profile URL.`, 'INVALID_URL', 400);
  return `https://www.${platform}.com/${platform === 'linkedin' ? 'in/' : ''}${match[1].toLowerCase()}/`;
}
const clean = (v, max = 8000) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const list = v => Array.isArray(v) ? v : [];
export class ApifyScraper {
  constructor(token = null) { this.token = token || process.env.APIFY_TOKEN || null; }
  setToken(token) { this.token = token; }
  extractLinkedInHandle(url) { return new URL(normalizeProfileUrl(url, 'linkedin')).pathname.split('/')[2]; }
  extractInstagramHandle(url) { return new URL(normalizeProfileUrl(url, 'instagram')).pathname.split('/')[1]; }
  async request(path, options = {}) {
    if (!this.token) throw new SourceError('Apify is not configured. Add a server token in Connection settings.', 'NOT_CONFIGURED', 503);
    let response;
    try { response = await fetch(`https://api.apify.com/v2${path}`, { ...options, headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(70000) }); }
    catch { throw new SourceError('The public source provider could not be reached. Please retry.', 'PROVIDER_UNREACHABLE'); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new SourceError(response.status === 401 ? 'The Apify token is invalid.' : `Apify rejected retrieval (${response.status}). Check token permissions and account credit.`, 'PROVIDER_REJECTED');
    return body;
  }
  async runActor(actorId, input, chargeLimit = 1) {
    const start = await this.request(`/acts/${actorId.replace('/', '~')}/runs?waitForFinish=60&timeout=180&maxTotalChargeUsd=${chargeLimit}`, { method: 'POST', body: JSON.stringify(input) });
    let run = start.data;
    if (!run?.id) throw new SourceError('The provider did not create a retrieval run.');
    const deadline = Date.now() + 210000;
    while (['READY', 'RUNNING'].includes(run.status) && Date.now() < deadline) { const result = await this.request(`/actor-runs/${run.id}?waitForFinish=10`); run = result.data; }
    if (run.status !== 'SUCCEEDED') {
      if (['READY', 'RUNNING'].includes(run.status)) await this.request(`/actor-runs/${run.id}/abort`, { method: 'POST' }).catch(() => {});
      throw new SourceError(`Public source retrieval ${run.status?.toLowerCase() || 'failed'}. No profile was created.`, 'RETRIEVAL_INCOMPLETE');
    }
    const items = await this.request(`/datasets/${run.defaultDatasetId}/items?clean=true&format=json`);
    if (!Array.isArray(items) || !items.length) throw new SourceError('No public profile was returned.', 'PROFILE_NOT_FOUND', 422);
    const fetchedAt = run.finishedAt || new Date().toISOString();
    return { items: items.map(item => ({ ...item, __auraRetrieval: { runId: run.id, fetchedAt } })), runId: run.id, fetchedAt };
  }
  async scrapeLinkedIn(url) {
    const canonical = normalizeProfileUrl(url, 'linkedin');
    const result = await this.runActor('harvestapi/linkedin-profile-scraper', { urls: [canonical], profileScraperMode: 'Profile details no email ($4 per 1k)' });
    return this.formatLinkedInData(result.items[0], canonical, this.extractLinkedInHandle(canonical), result);
  }
  async scrapeInstagram(url) {
    const canonical = normalizeProfileUrl(url, 'instagram');
    const result = await this.runActor('apify/instagram-scraper', { directUrls: [canonical], resultsType: 'details', resultsLimit: 1 });
    return this.formatInstagramData(result.items[0], canonical, this.extractInstagramHandle(canonical), result);
  }
  formatLinkedInData(item, url, handle, retrieval = {}) {
    retrieval = item.__auraRetrieval || retrieval;
    const fullName = clean(item.fullName || item.name || [item.firstName, item.lastName].filter(Boolean).join(' '), 150);
    if (item.error || !fullName || !clean(item.headline || item.about || item.summary)) throw new SourceError('LinkedIn did not return a readable public profile.', 'PROFILE_NOT_FOUND', 422);
    const returnedUrl = item.linkedinUrl || item.profileUrl || item.url;
    if (returnedUrl && normalizeProfileUrl(returnedUrl, 'linkedin') !== url) throw new SourceError('LinkedIn returned a different identity. Check the profile URL.', 'IDENTITY_MISMATCH', 422);
    return { source: 'apify:harvestapi/linkedin-profile-scraper', url, handle, fullName, fetchedAt: retrieval.fetchedAt || new Date().toISOString(), runId: retrieval.runId || null,
      headline: clean(item.headline, 500), about: clean(item.about || item.summary),
      experience: list(item.experience || item.experiences).slice(0, 12).map(e => ({ title: clean(e.position || e.title, 250), company: clean(e.companyName || e.company?.name || e.company, 250), description: clean(e.description, 2000) })),
      education: list(item.education).slice(0, 6).map(e => ({ school: clean(e.schoolName || e.school?.name || e.school, 250), field: clean(e.fieldOfStudy || e.degreeName || e.degree, 250) })),
      skills: list(item.skills).map(s => clean(typeof s === 'string' ? s : s.name, 150)).filter(Boolean).slice(0, 25) };
  }
  formatInstagramData(item, url, handle, retrieval = {}) {
    retrieval = item.__auraRetrieval || retrieval;
    if (item.error) throw new SourceError('Instagram did not return this profile.', 'PROFILE_NOT_FOUND', 422);
    if (item.isPrivate === true || item.private === true) throw new SourceError('Private Instagram profiles are not supported.', 'PRIVATE_INSTAGRAM', 422);
    if (item.isPrivate !== false && item.private !== false) throw new SourceError('The provider could not confirm that Instagram is public.', 'PUBLIC_STATUS_UNKNOWN', 422);
    if (!item.username || item.username.toLowerCase() !== handle.toLowerCase()) throw new SourceError('Instagram returned a different account.', 'IDENTITY_MISMATCH', 422);
    return { source: 'apify:apify/instagram-scraper', url, handle, fullName: clean(item.fullName, 150), public: true, fetchedAt: retrieval.fetchedAt || new Date().toISOString(), runId: retrieval.runId || null,
      bio: clean(item.biography || item.bio, 2500), recentPosts: list(item.latestPosts).slice(0, 12).map(p => clean(p.caption, 4000)).filter(Boolean),
      postUrls: list(item.latestPosts).slice(0, 12).map(p => clean(p.url, 500)).filter(v => /^https:\/\/(www\.)?instagram\.com\//.test(v)) };
  }
}
