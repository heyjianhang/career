// Pure arithmetic for the documented rubric. Never reads or mutates a workspace.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const round = n => Math.round(n * 100) / 100;
export function scoreCriteria(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(k => k !== 'criteria')
      || !Array.isArray(input.criteria) || !input.criteria.length) {
    throw new Error('Expected {criteria: [...]} with at least one criterion');
  }
  const ids = new Set();
  let total = 0, known = 0, points = 0;
  const unknown = [];
  for (const item of input.criteria) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
        || Object.keys(item).some(k => !['id','weight','score','evidence','reason'].includes(k))) {
      throw new Error('Invalid criterion fields');
    }
    if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error('Criterion ids must be nonempty and unique');
    ids.add(item.id);
    if (!Number.isFinite(item.weight) || item.weight <= 0 || item.weight > 100) throw new Error('Weights must be positive finite numbers, at most 100');
    if (item.score !== null && (!Number.isInteger(item.score) || item.score < 0 || item.score > 4)) throw new Error('Score must be 0–4 or null for unknown');
    if (typeof item.reason !== 'string' || !item.reason.trim()) throw new Error('Every criterion needs a reason, including unknowns');
    if (!Array.isArray(item.evidence) || item.evidence.some(s => typeof s !== 'string' || !s.trim())
        || (item.score !== null && !item.evidence.length)) throw new Error('Known scores need evidence references');
    total += item.weight;
    if (item.score === null) unknown.push(item.id);
    else { known += item.weight; points += item.weight * item.score; }
  }
  if (Math.abs(total - 100) > 0.000001) throw new Error('Weights must sum to 100; do not silently drop unknown criteria');
  const coverage = known / total * 100;
  const lower = points / (4 * total) * 100;
  return {
    method: 'career-decision-score/v1',
    known_score: known ? round(points / (4 * known) * 100) : null,
    evidence_coverage: round(coverage),
    missing_extremes: {lower: round(lower), upper: round(lower + 100 - coverage)},
    unknown,
    limitation: 'Arithmetic only; coverage is not reliability, bounds are not confidence intervals. Review evidence, gates and user preferences before recommending.'
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node score-opportunity.mjs <assessment.json>');
    const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
    console.log(JSON.stringify(scoreCriteria(input), null, 2));
  } catch (error) {
    // Do not print the input file or arbitrary parser contents (which may be private).
    console.error(JSON.stringify({error: error instanceof SyntaxError ? 'Invalid JSON' : error.code ? 'Cannot read assessment input' : error.message}));
    process.exitCode = 1;
  }
}
