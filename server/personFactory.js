import { createHash } from 'node:crypto';
import { SourceError } from './apifyScraper.js';
import { ProfileAnalyzer } from './profileAnalyzer.js';

const normalizeName = value => value.split(/[|–—]/)[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/(?<=[a-z])-(?=[a-z])/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
export function namesMatch(a, b) {
  const first = normalizeName(a), second = normalizeName(b);
  if (first.length < 2 || second.length < 2) return false;
  return first.every(word => second.includes(word)) || second.every(word => first.includes(word));
}
export function createPerson(linkedin, instagram) {
  if (instagram.public !== true) throw new SourceError('A confirmed public Instagram profile is required.', 'PUBLIC_STATUS_UNKNOWN', 422);
  if (!namesMatch(linkedin.fullName, instagram.fullName)) throw new SourceError('The names on the two profiles do not match. We cannot establish the same person from these sources.', 'IDENTITY_MISMATCH', 422);
  const name = linkedin.fullName;
  const id = createHash('sha256').update(`${linkedin.url}|${instagram.url}`).digest('hex').slice(0, 16);
  return {
    id, name, role: linkedin.headline || 'Public profile', avatar: null, linkedinUrl: linkedin.url, instagramUrl: instagram.url,
    linkedinHandle: linkedin.handle, instagramHandle: instagram.handle, scrapedData: { linkedin, instagram },
    analysis: new ProfileAnalyzer().analyze(name, linkedin, instagram), createdAt: new Date().toISOString(),
    provenance: { status: 'retrieved', identityStatus: 'name_match', identityNote: 'Names match across both profiles; account ownership and participation are not independently verified.', instagramPublic: true, sourceCount: 2, fetchedAt: [linkedin.fetchedAt, instagram.fetchedAt].sort()[0] }
  };
}
