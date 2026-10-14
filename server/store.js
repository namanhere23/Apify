import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { DatingSimulationEngine } from './simulationEngine.js';
const engine = new DatingSimulationEngine();
export class Store {
  constructor(directory) { this.directory = directory; this.file = path.join(directory, 'state.json'); this.people = []; this.dates = {}; this.queue = Promise.resolve(); }
  async load() {
    let saved;
    try { saved = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Saved state is unreadable. Preserve it and repair the JSON before starting.');
      try { saved = JSON.parse(await readFile(path.join(this.directory, 'demo-cohort.json'), 'utf8')); } catch (seedError) { if (seedError.code !== 'ENOENT') throw seedError; saved = { people: [], dates: {} }; }
    }
    this.people = saved.people || []; this.dates = saved.dates || {};
    for (const person of this.people) if (!person.analysis?.claims || person.scrapedData?.instagram?.public !== true) throw new Error('Saved profiles do not satisfy the two-public-source data contract.');
    this.completeDates(); await this.save(); return this;
  }
  getDate(a, b) {
    const id = engine.pairId(a.id, b.id);
    if (!this.dates[id]) this.dates[id] = engine.simulateDate(a, b);
    return this.dates[id];
  }
  completeDates() { for (let i = 0; i < this.people.length; i++) for (let j = i + 1; j < this.people.length; j++) this.getDate(this.people[i], this.people[j]); }
  rankings(person) { return engine.generateRankingsForPerson(person, this.people, (a, b) => this.getDate(a, b)); }
  async add(person) {
    // Recheck after retrieval: concurrent imports of the same pair must not duplicate records.
    const existing = this.people.find(p => p.linkedinUrl === person.linkedinUrl || p.instagramUrl === person.instagramUrl);
    if (existing) return existing;
    this.people.push(person); this.completeDates(); await this.save(); return person;
  }
  export() { return { version: 2, people: this.people, dates: this.dates }; }
  async save() {
    const data = JSON.stringify(this.export(), null, 2);
    this.queue = this.queue.catch(() => {}).then(async () => { await mkdir(this.directory, { recursive: true }); const temporary = `${this.file}.tmp`; await writeFile(temporary, data, 'utf8'); await rename(temporary, this.file); });
    return this.queue;
  }
}
