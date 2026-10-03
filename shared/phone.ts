export const phoneTemplate = '+7 (___) ___-__-__';
export const phoneSlots = [4, 5, 6, 9, 10, 11, 13, 14, 16, 17] as const;

// Server validation must never silently truncate an incomplete or oversized number.
export function normalizePhone(value: string): string | undefined {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(compact)) return `+7${compact}`;
  if (/^\+?[78]\d{10}$/.test(compact)) return `+7${compact.replace(/^\+?[78]/, '')}`;
}

export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (value.trim().startsWith('+7') || (digits.length >= 11 && /^[78]/.test(digits)))
    digits = digits.slice(1);
  return digits.slice(0, 10);
}

export function maskPhone(digits: string): string {
  const result = phoneTemplate.split('');
  for (let i = 0; i < Math.min(digits.length, phoneSlots.length); i++)
    result[phoneSlots[i]] = digits[i];
  return result.join('');
}

export function formatPhone(value: string): string {
  const normalized = normalizePhone(value);
  return normalized ? maskPhone(normalized.slice(2)) : value;
}

export function editPhone(
  value: string,
  start: number,
  end: number,
  insertion: string,
  deletion?: 'Backspace' | 'Delete',
): { value: string; caret: number } {
  const digits = phoneDigits(value);
  let from = Math.min(digits.length, phoneSlots.filter((position) => position < start).length);
  let to = Math.min(digits.length, phoneSlots.filter((position) => position < end).length);
  if (start === end && deletion === 'Backspace') from = Math.max(0, from - 1);
  if (start === end && deletion === 'Delete') to = Math.min(digits.length, from + 1);
  const inserted = insertion.slice(0, 10 - (digits.length - (to - from)));
  const next = digits.slice(0, from) + inserted + digits.slice(to);
  const index = from + inserted.length;
  return { value: maskPhone(next), caret: phoneSlots[index] ?? phoneTemplate.length };
}
