import { createHash } from 'node:crypto';

const intersection = (a, b) => a.filter(value => b.includes(value));
const percent = (matches, total) => total ? Math.round(matches / total * 100) : 0;
const compact = person => ({ id: person.id, name: person.name, avatar: person.avatar, role: person.role });
const E = (person, topic) => person.analysis.claims.find(c => c.label === topic);
const ref = (person, topic) => E(person, topic) ? [`${person.id}:${E(person, topic).id}`] : [];
const version = 'policy-v2';

/** Each agent has its own evidence, memory and decisions. Agents speak as agents, never as the real person. */
class EvidenceAgent {
  constructor(person, counterpart) {
    this.person = person; this.counterpart = counterpart;
    this.memory = { heardTopics: [], openQuestions: [...person.analysis.unknowns], responses: 0, proposalAccepted: false };
  }
  observe(turn) {
    this.memory.responses++;
    if (turn.topic && !this.memory.heardTopics.includes(turn.topic)) this.memory.heardTopics.push(turn.topic);
    if (turn.intent === 'propose') this.memory.proposal = turn.proposal;
  }
  say(phase, text, topic, intent, note, extra = {}) {
    return { speaker: `${this.person.name.split(' ')[0]}'s agent`, speakerId: this.person.id, avatar: null, phase, text, topic, intent,
      evidenceIds: [...ref(this.person, topic), ...ref(this.counterpart, topic)], innerMonologue: note, memory: structuredClone(this.memory), ...extra };
  }
}

export class DatingSimulationEngine {
  pairId(a, b) {
    const ids = [a, b].sort();
    return createHash('sha256').update(`${version}:${ids.join(':')}`).digest('hex').slice(0, 24);
  }
  simulateDate(first, second) {
    // Canonical order makes repeated requests and reversed pairs resolve to exactly one session.
    const [a, b] = [first, second].sort((x, y) => x.id.localeCompare(y.id));
    const agentA = new EvidenceAgent(a, b), agentB = new EvidenceAgent(b, a);
    const sharedTopics = intersection(a.analysis.topics, b.analysis.topics);
    const sharedHobbies = intersection(a.analysis.hobbies, b.analysis.hobbies);
    const topic = sharedHobbies[0] || sharedTopics[0] || a.analysis.topics[0] || 'an open conversation';
    const otherTopic = b.analysis.topics.find(t => !a.analysis.topics.includes(t)) || b.analysis.topics[0] || 'an open conversation';
    const activity = sharedHobbies.includes('Hiking') ? 'a short park walk' : sharedHobbies.includes('Art') || sharedTopics.includes('Design') ? 'a gallery visit followed by a café conversation' : sharedHobbies.includes('Sport') || sharedHobbies.includes('Fitness') ? 'an easy walk and a café stop' : 'a quiet café conversation';
    const venue = { name: activity, atmosphere: 'A hypothetical, low-pressure setting selected by the agents from the available topic signals. Place and time need the people’s confirmation.' };
    const turns = [];
    function exchange(agent, other, turn) { turns.push({ turn: turns.length + 1, ...turn }); other.observe(turn); }
    exchange(agentA, agentB, agentA.say('Opening', `Hi! I’m the agent reading ${a.name}'s two public profiles. ${sharedTopics.length ? `We have a possible opening around ${topic.toLowerCase()}.` : 'Our profiles have few shared topics, so I want to test a conversation instead of assume a match.'} What can your sources actually tell me?`, topic, 'ask', `Select a grounded opener. ${sharedTopics.length} shared topic signals; needs remain unknown.`));
    const factB = E(b, topic) || b.analysis.claims[0];
    exchange(agentB, agentA, agentB.say('Opening', `Hello! ${factB ? `${b.name}'s ${factB.source} profile mentions ${factB.label.toLowerCase()}.` : 'I have too little topic evidence to make a claim.'} ${E(b, topic) ? `I can discuss ${topic.toLowerCase()} from that evidence.` : `I can offer ${otherTopic.toLowerCase()} as another starting point.`} I cannot tell you whether my person wants to date.`, factB?.label, 'answer', `Remember the opening topic. Respond using ${factB?.id || 'no claim'}; preserve participation as unknown.`));
    exchange(agentA, agentB, agentA.say('Discovery', `Picking up on your answer about ${(factB?.label || otherTopic).toLowerCase()}: ${sharedTopics.length ? `our sources also overlap on ${sharedTopics.slice(0, 3).join(', ').toLowerCase()}.` : `that would be a new topic for my person’s profile.`} What would help us move beyond comparing résumés?`, factB?.label, 'ask', `Use the previous reply from memory; ${agentA.memory.heardTopics.length} topics remembered.`));
    const hobbyB = b.analysis.hobbies[0];
    exchange(agentB, agentA, agentB.say('Discovery', `${hobbyB ? `The public profile includes a mention of ${hobbyB.toLowerCase()}; we could ask if that is a personal hobby.` : 'I don’t have a supported leisure hobby to offer yet.'} ${otherTopic !== topic ? `A different conversation thread is ${otherTopic.toLowerCase()}.` : `Let’s explore what ${topic.toLowerCase()} means outside work.`} Those are questions for the person, not settled preferences.`, hobbyB || otherTopic, 'answer', 'Separate a topic mention from a preferred activity. Record the gap before proposing a plan.'));
    exchange(agentA, agentB, agentA.say('Trade-offs', `${sharedTopics.length ? `There is a topic bridge, but ${a.analysis.topics.filter(t => !b.analysis.topics.includes(t)).slice(0, 2).join(' and ').toLowerCase() || 'our individual motivations'} still needs exploring.` : 'Our topic signals differ; I would keep this exploratory.'} I cannot infer relationship needs, availability or boundaries. How should we handle that gap?`, topic, 'ask', 'Actively test uncertainty; do not assign traits or invent relationship requirements.'));
    exchange(agentB, agentA, agentB.say('Trade-offs', `Keep it open. Both people would need to confirm their interest, what they need, and whether this activity suits them. ${sharedHobbies.length ? `The ${sharedHobbies[0].toLowerCase()} overlap gives us a concrete option.` : 'With no confirmed shared leisure signal, a short conversation is the least assumption-heavy proposal.'}`, sharedHobbies[0] || topic, 'answer', `Reply to the uncertainty question. ${sharedHobbies.length} shared hobby mentions; no assumptions about romantic intent.`));
    exchange(agentA, agentB, agentA.say('Plan', `For this simulated date, I propose ${activity}, with one conversation about ${topic.toLowerCase()} and room for ${(hobbyB || otherTopic).toLowerCase()}. Is that a reasonable agent-level plan pending human confirmation?`, topic, 'propose', 'Choose the plan using shared leisure evidence, then shared topics, then a neutral café fallback.', { proposal: activity }));
    agentB.memory.proposalAccepted = sharedTopics.length > 0;
    exchange(agentB, agentA, agentB.say('Plan', sharedTopics.length ? `Yes, as an exploratory proposal. I heard your plan for ${agentB.memory.proposal}; it gives both topic sets space. My person still has to choose whether to participate.` : `I would hold the plan for now. ${agentB.memory.proposal} is workable, but the sources do not yet establish a shared interest. Ask both people first.`, topic, 'decision', `Decision: ${sharedTopics.length ? 'propose with open questions' : 'hold for more information'}. Respond to the actual plan in memory.`));
    agentA.memory.proposalAccepted = agentB.memory.proposalAccepted;
    exchange(agentA, agentB, agentA.say('Reflection', `My debrief: ${sharedTopics.length ? `a conversation has a bridge through ${sharedTopics.slice(0, 2).join(' and ').toLowerCase()}` : 'we have a discovery opportunity rather than a strong source-supported overlap'}. I’m carrying the unanswered relationship and participation questions forward into the ranking explanation.`, topic, 'reflect', 'Evaluate conversation fit for my own person; retain uncertainty.'));
    exchange(agentB, agentA, agentB.say('Reflection', `My debrief: ${agentB.memory.proposalAccepted ? 'the agent-level plan is coherent with the topic evidence' : 'I need more information before recommending the plan'}. We exchanged ${agentB.memory.responses} replies in this simulation. This is a topic-fit experiment, not a statement of attraction by either person.`, topic, 'reflect', `Finalize independent evaluation from ${agentB.memory.heardTopics.length} remembered topics.`));

    function evaluate(target, partner, agent) {
      const interestOverlap = intersection(target.analysis.interests, partner.analysis.interests);
      const hobbyOverlap = intersection(target.analysis.hobbies, partner.analysis.hobbies);
      const interests = percent(interestOverlap.length, target.analysis.interests.length);
      const hobbies = percent(hobbyOverlap.length, target.analysis.hobbies.length);
      const conversation = Math.min(100, (sharedTopics.length ? 55 : 20) + (agent.memory.proposalAccepted ? 20 : 0) + Math.min(25, agent.memory.heardTopics.filter(t => target.analysis.topics.includes(t)).length * 5));
      const evidence = Math.min(target.analysis.coverage, partner.analysis.coverage);
      const weights = { interests: target.analysis.interests.length ? 45 : 0, hobbies: target.analysis.hobbies.length ? 30 : 0, conversation: 15, evidence: 10 };
      const breakdown = { interests, hobbies, conversation, evidence };
      const totalWeight = Object.values(weights).reduce((sum, v) => sum + v, 0);
      const score = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + breakdown[key] * weight, 0) / totalWeight);
      return { personId: target.id, name: target.name, score, breakdown, weights, decision: sharedTopics.length ? 'Explore with the people’s confirmation' : 'More evidence needed',
        reasons: [sharedTopics.length ? `Shared topic mentions: ${sharedTopics.join(', ')}.` : 'No shared topic mentions were found.', hobbyOverlap.length ? `Shared leisure mentions: ${hobbyOverlap.join(', ')}.` : 'No shared leisure mentions established.', `${agent.memory.proposalAccepted ? 'Agents accepted an exploratory plan' : 'Agents held the proposal'} after the uncertainty round.`],
        openQuestions: [...target.analysis.unknowns], confidence: evidence >= 80 ? 'Broad topic evidence' : evidence >= 50 ? 'Partial topic evidence' : 'Limited topic evidence' };
    }
    const debriefs = [evaluate(a, b, agentA), evaluate(b, a, agentB)];
    const compositeScore = Math.round((debriefs[0].score + debriefs[1].score) / 2);
    const breakdown = Object.fromEntries(Object.keys(debriefs[0].breakdown).map(key => [key, Math.round((debriefs[0].breakdown[key] + debriefs[1].breakdown[key]) / 2)]));
    const badge = compositeScore >= 75 ? 'Strong topic fit' : compositeScore >= 50 ? 'Some shared ground' : 'Exploratory';
    return { dateId: this.pairId(a.id, b.id), engineVersion: version, personA: compact(a), personB: compact(b), venue, turns, debriefs, sharedTopics,
      compatibility: { compositeScore, breakdown, badge, verdict: badge }, createdAt: new Date().toISOString(), mode: 'rule-based',
      agentDebrief: `Both agents completed ${turns.length} turns across opening, discovery, trade-offs, planning and reflection. Mutual public-topic fit: ${compositeScore}/100. Relationship needs and participation remain unconfirmed.`,
      disclaimer: 'A rule-based simulation from LinkedIn and public Instagram topic mentions. These people have not been enrolled as dating participants. Scores are heuristic conversation-fit indices, not probabilities of romantic compatibility.' };
  }
  generateRankingsForPerson(target, people, getDate = (a, b) => this.simulateDate(a, b)) {
    return people.filter(p => p.id !== target.id).map(partner => {
      const session = getDate(target, partner), debrief = session.debriefs.find(d => d.personId === target.id);
      return { ...compact(partner), archetype: partner.analysis.archetype, linkedinUrl: partner.linkedinUrl, instagramUrl: partner.instagramUrl, score: debrief.score,
        mutualScore: session.compatibility.compositeScore, breakdown: debrief.breakdown, badge: session.compatibility.badge, verdict: debrief.decision, rationale: debrief.reasons.join(' '),
        confidence: debrief.confidence, dateId: session.dateId, sharedTopics: session.sharedTopics, openQuestions: debrief.openQuestions };
    }).sort((a, b) => b.score - a.score || b.mutualScore - a.mutualScore || a.id.localeCompare(b.id)).map((p, index) => ({ rank: index + 1, ...p }));
  }
}
