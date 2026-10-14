/** Explainable topic extraction. Unstated relationship needs and sensitive traits remain unknown. */
const TOPICS = [
  ['Technology', /\b(technology|tech|software|coding|programming|developer)\b/i, 'interest'],
  ['Artificial intelligence', /\b(artificial intelligence|machine learning|AI|LLM|robotics)\b/i, 'interest'],
  ['Entrepreneurship', /\b(founder|co-founder|entrepreneur|startup|startups|business owner)\b/i, 'interest'],
  ['Design', /\b(design|designer|architecture|architect)\b/i, 'interest'],
  ['Writing', /\b(author|writer|writing|book|newsletter|storytelling)\b/i, 'interest'],
  ['Video & media', /\b(youtuber|youtube|video|filmmaking|podcast|podcaster|creator)\b/i, 'interest'],
  ['Education', /\b(teach|teaching|educator|education|learning|course|professor)\b/i, 'interest'],
  ['Investing', /\b(investor|investing|venture capital|investment|fund)\b/i, 'interest'],
  ['Marketing', /\b(marketing|branding|advertising|growth strategy)\b/i, 'interest'],
  ['Science', /\b(science|scientist|research|researcher|physics|neuroscience)\b/i, 'interest'],
  ['Sustainability', /\b(sustainability|sustainable|environment|climate)\b/i, 'interest'],
  ['Community projects', /\b(community|volunteer|mentoring|mentor)\b/i, 'interest'],
  ['Productivity', /\b(productivity|time management|focus|habits)\b/i, 'interest'],
  ['Travel', /\b(travel|travelling|traveling|nomad|exploring|trip)\b/i, 'hobby'],
  ['Hiking', /\b(hiking|hike|trail|mountaineering)\b/i, 'hobby'],
  ['Fitness', /\b(fitness|workout|gym|weightlifting|pilates|running|marathon|yoga)\b/i, 'hobby'],
  ['Music', /\b(music|guitar|piano|singing|vinyl|concert)\b/i, 'hobby'],
  ['Reading', /\b(reading|books|book club|read a book)\b/i, 'hobby'],
  ['Food & cooking', /\b(cooking|baking|food|restaurant|coffee|cafe)\b/i, 'hobby'],
  ['Photography', /\b(photography|photographer|photographing)\b/i, 'hobby'],
  ['Sport', /\b(tennis|basketball|football|soccer|golf|frisbee|cycling|surfing)\b/i, 'hobby'],
  ['Art', /\b(artist|painting|art gallery|sculpture|drawing)\b/i, 'hobby']
];
export class ProfileAnalyzer {
  analyze(name, linkedin, instagram) {
    const fields = [
      { source: 'linkedin', field: 'headline', text: linkedin.headline }, { source: 'linkedin', field: 'about', text: linkedin.about },
      ...(linkedin.experience || []).map((e, i) => ({ source: 'linkedin', field: `experience[${i}]`, text: [e.title, e.company, e.description].filter(Boolean).join(' · ') })),
      ...(linkedin.skills || []).map((s, i) => ({ source: 'linkedin', field: `skills[${i}]`, text: s })),
      { source: 'instagram', field: 'bio', text: instagram.bio }, ...(instagram.recentPosts || []).map((p, i) => ({ source: 'instagram', field: `recentPosts[${i}]`, text: p }))
    ].filter(f => typeof f.text === 'string' && f.text.trim());
    const claims = [];
    for (const [label, pattern, category] of TOPICS) {
      const evidence = fields.find(f => pattern.test(f.text)); if (!evidence) continue;
      const position = evidence.text.search(pattern);
      claims.push({ id: `claim-${claims.length + 1}`, category, label, source: evidence.source, url: evidence.source === 'linkedin' ? linkedin.url : instagram.url, field: evidence.field, excerpt: evidence.text.slice(Math.max(0, position - 65), position + 155).trim(), confidence: 'observed' });
    }
    const interests = claims.filter(c => c.category === 'interest').map(c => c.label), hobbies = claims.filter(c => c.category === 'hobby').map(c => c.label);
    const sourceCounts = { linkedin: fields.filter(f => f.source === 'linkedin').length, instagram: fields.filter(f => f.source === 'instagram').length };
    const coverage = Math.round(((Math.min(sourceCounts.linkedin, 5) / 5) + (Math.min(sourceCounts.instagram, 5) / 5)) * 50);
    return { archetype: interests[0] ? `${interests[0]} explorer` : 'Open conversation',
      summary: `${name}'s two public profiles mention ${[...interests, ...hobbies].slice(0, 5).join(', ') || 'too few topics for a reliable analysis'}. These are conversation signals; a caption may not describe a personal preference.`,
      needs: ['Relationship needs are unknown: neither public profile establishes them.'], hobbies, interests, qualities: [`${claims.length} traceable topic signals across two public profiles`], greenFlags: [], redFlags: [],
      datingStyle: 'Ask grounded questions, remember answers, propose a shared activity, and preserve unanswered needs as open questions.', claims, topics: claims.map(c => c.label), coverage, sourceCounts,
      unknowns: ['Relationship needs and boundaries', 'Interest in participating or meeting', 'Preferred date location and schedule', 'Whether a mentioned activity is a personal hobby'] };
  }
}
