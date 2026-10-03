import { useId, useLayoutEffect, useRef, useState } from 'react';
import { editPhone, maskPhone, phoneDigits, phoneSlots } from '../../../shared/phone';

export function PhoneField({
  label = 'Телефон',
  name = 'phone',
  defaultValue = '',
  error,
  required = true,
  readOnly = false,
}: {
  label?: string;
  name?: string;
  defaultValue?: string;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(() => maskPhone(phoneDigits(defaultValue)));
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);
  function update(next: { value: string; caret: number }) {
    if (next.value === value) input.current?.setSelectionRange(next.caret, next.caret);
    else {
      caret.current = next.caret;
      setValue(next.value);
    }
  }
  return (
    <label className="field" htmlFor={id}>
      <span>
        {label}
        {required && ' *'}
      </span>
      <input
        ref={input}
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={value}
        required={required}
        readOnly={readOnly}
        pattern={String.raw`\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}`}
        title="Введите 10 цифр номера: +7 (___) ___-__-__"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onFocus={(event) => {
          if (!phoneDigits(value)) event.currentTarget.setSelectionRange(4, 4);
        }}
        onKeyDown={(event) => {
          if (readOnly) return;
          if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing)
            return;
          if (/^\d$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            update(
              editPhone(
                value,
                event.currentTarget.selectionStart ?? 4,
                event.currentTarget.selectionEnd ?? 4,
                /^\d$/.test(event.key) ? event.key : '',
                event.key === 'Backspace' || event.key === 'Delete' ? event.key : undefined,
              ),
            );
          } else if (event.key.length === 1) event.preventDefault();
        }}
        onPaste={(event) => {
          if (readOnly) return;
          event.preventDefault();
          update(
            editPhone(
              value,
              event.currentTarget.selectionStart ?? 4,
              event.currentTarget.selectionEnd ?? 4,
              phoneDigits(event.clipboardData.getData('text')),
            ),
          );
        }}
        onChange={(event) => {
          if (readOnly) return;
          const digits = phoneDigits(event.currentTarget.value);
          update({ value: maskPhone(digits), caret: phoneSlots[digits.length] ?? 18 });
        }}
      />
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </label>
  );
}
