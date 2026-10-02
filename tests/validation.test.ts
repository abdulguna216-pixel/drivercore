import test from 'node:test';
import assert from 'node:assert/strict';
import { datetime, password } from '../backend/src/utils/validation.js';
import { csvCell } from '../frontend/src/utils/csv.js';
import { sameSecret } from '../backend/src/utils/constant-time.js';
test('Reject invalid offsets and preserve valid calendar instants', () => {
  for (const value of ['2026-10-05T10:00:00+99:99', '2026-10-05T10:00:00+03:99', '2026-10-05T10:00:00+14:01', '2026-10-05T10:00:00+1500']) assert.equal(datetime.safeParse(value).success, false);
  assert.equal(datetime.safeParse('2026-10-05T10:00:00+03:00').success, true);
});
test('Enforce bcrypt byte bound, including Unicode', () => {
  assert.equal(password.safeParse('a'.repeat(72)).success, true);
  assert.equal(password.safeParse('a'.repeat(73)).success, false);
  assert.equal(password.safeParse('😀'.repeat(20)).success, false);
});
test('CSV values cannot become formulas, even with leading whitespace', () => {
  for (const value of ['=1+1', '\t=1+1', ' +SUM(1)', '-1+1', '@SUM(1)']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Brake "service"'), '"Brake ""service"""');
});
test('Malformed Unicode secrets are rejected without throwing', () => {
  assert.equal(sameSecret('abcd', 'éééé'), false);
  assert.equal(sameSecret('abcd', 'abc'), false);
  assert.equal(sameSecret('abcd', 'abce'), false);
  assert.equal(sameSecret('abcd', 'abcd'), true);
});
