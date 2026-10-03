import test from 'node:test';
import assert from 'node:assert/strict';
import { datetime, password, phone } from '../backend/src/utils/validation.js';
import { editPhone, maskPhone, phoneDigits, phoneTemplate } from '../shared/phone.js';
import { csvCell } from '../frontend/src/utils/csv.js';
import { sameSecret } from '../backend/src/utils/constant-time.js';
test('Reject invalid offsets and preserve valid calendar instants', () => {
  for (const value of [
    '2026-10-05T10:00:00+99:99',
    '2026-10-05T10:00:00+03:99',
    '2026-10-05T10:00:00+14:01',
    '2026-10-05T10:00:00+1500',
  ])
    assert.equal(datetime.safeParse(value).success, false);
  assert.equal(datetime.safeParse('2026-10-05T10:00:00+03:00').success, true);
});
test('Enforce bcrypt byte bound, including Unicode', () => {
  assert.equal(password.safeParse('a'.repeat(72)).success, true);
  assert.equal(password.safeParse('a'.repeat(73)).success, false);
  assert.equal(password.safeParse('😀'.repeat(20)).success, false);
});
test('CSV values cannot become formulas, even with leading whitespace', () => {
  for (const value of ['=1+1', '\t=1+1', ' +SUM(1)', '-1+1', '@SUM(1)'])
    assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Brake "service"'), '"Brake ""service"""');
});
test('Malformed Unicode secrets are rejected without throwing', () => {
  assert.equal(sameSecret('abcd', 'éééé'), false);
  assert.equal(sameSecret('abcd', 'abc'), false);
  assert.equal(sameSecret('abcd', 'abce'), false);
  assert.equal(sameSecret('abcd', 'abcd'), true);
});
test('Russian phone numbers require exactly ten digits after the fixed +7 prefix', () => {
  for (const value of ['+7 (912) 345-67-89', '+79123456789', '89123456789', '9123456789'])
    assert.equal(phone.parse(value), '+79123456789');
  for (const value of [
    phoneTemplate,
    '+7 (912) 345-67-8_',
    '+7912345678',
    '+791234567890',
    '+19123456789',
    '+7abc9123456789',
  ])
    assert.equal(phone.safeParse(value).success, false, value);
});
test('Phone mask limits pasted numbers and accepts a domestic 8 prefix', () => {
  assert.equal(maskPhone(phoneDigits('8 (912) 345-67-89')), '+7 (912) 345-67-89');
  assert.equal(maskPhone(phoneDigits('+7 (912) 345-67-890123')), '+7 (912) 345-67-89');
  assert.equal(maskPhone(phoneDigits('+7')), phoneTemplate);
  assert.equal(editPhone('+7 (912) 345-67-89', 18, 18, '0').value, '+7 (912) 345-67-89');
});
test('Phone editing handles separators, selected digits and protected country prefix', () => {
  assert.deepEqual(editPhone('+7 (912) 3__-__-__', 9, 9, '', 'Backspace'), {
    value: '+7 (913) ___-__-__',
    caret: 6,
  });
  assert.equal(editPhone('+7 (912) 345-67-89', 4, 7, '999').value, '+7 (999) 345-67-89');
  assert.equal(editPhone('+7 (912) 345-67-89', 4, 4, '', 'Backspace').value, '+7 (912) 345-67-89');
  assert.equal(editPhone('+7 (912) 345-67-89', 0, 18, '').value, phoneTemplate);
});
