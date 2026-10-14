import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCriteria} from '../.agents/skills/career-board/scripts/score-opportunity.mjs';

const criterion = (id, weight, score) => ({id, weight, score, evidence: score === null ? [] : ['synthetic/source'], reason: score === null ? 'Not asked' : 'Confirmed synthetic evidence'});
const calculate = (...criteria) => scoreCriteria({criteria});

test('unknown requirements retain their weight; worked example stays reproducible', () => {
  const result = calculate(criterion('delivery',40,3),criterion('evaluation',25,2),criterion('operations',20,null),criterion('collaboration',15,3));
  assert.equal(result.known_score,67.19);
  assert.equal(result.evidence_coverage,80);
  assert.deepEqual(result.missing_extremes,{lower:53.75,upper:73.75});
  assert.deepEqual(result.unknown,['operations']);
  assert.equal('recommendation' in result,false);
});
test('no evidence is unknown; confirmed absence is zero with complete coverage', () => {
  const unknown=calculate(criterion('one',100,null));
  assert.equal(unknown.known_score,null);assert.equal(unknown.evidence_coverage,0);
  assert.deepEqual(unknown.missing_extremes,{lower:0,upper:100});
  const absent=calculate(criterion('one',100,0));
  assert.equal(absent.known_score,0);assert.equal(absent.evidence_coverage,100);
  assert.deepEqual(absent.missing_extremes,{lower:0,upper:0});
});
test('high known score cannot hide low coverage', () => {
  const result=calculate(criterion('known',40,4),criterion('unknown',60,null));
  assert.equal(result.known_score,100);assert.equal(result.evidence_coverage,40);
  assert.deepEqual(result.missing_extremes,{lower:40,upper:100});
});
test('additional evidence narrows bounds without mutating the input', () => {
  const input={criteria:[criterion('a',30,3),criterion('b',25,null),criterion('c',25,3),criterion('d',20,2)]};
  const saved=structuredClone(input);assert.equal(scoreCriteria(input).known_score,68.33);
  assert.deepEqual(input,saved);
  input.criteria[1]=criterion('b',25,3);
  const result=scoreCriteria(input);assert.equal(result.known_score,70);
  assert.deepEqual(result.missing_extremes,{lower:70,upper:70});
});
test('invalid scales, missing evidence and dropped weights fail rather than silently score', () => {
  for (const score of [-1,5,2.5,'3',undefined,NaN]) assert.throws(()=>calculate(criterion('a',100,score)));
  for (const weight of [0,-1,Infinity,NaN,'100',99]) assert.throws(()=>calculate(criterion('a',weight,3)));
  assert.throws(()=>calculate(criterion('a',50,3),criterion('a',50,2)));
  assert.throws(()=>calculate({...criterion('a',100,3),evidence:[]}));
  assert.throws(()=>calculate({...criterion('a',100,null),reason:''}));
  assert.throws(()=>scoreCriteria({criteria:[]}));
  assert.throws(()=>scoreCriteria({criteria:[criterion('a',100,3)],user_rating:5}));
});
