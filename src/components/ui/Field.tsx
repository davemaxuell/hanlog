'use client';
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
type Details = { label: string; hint?: string; error?: string; counter?: { value: number; max: number } };
export function Field({ label, hint, error, counter, id, ...props }: InputHTMLAttributes<HTMLInputElement> & Details) {
  const generated = useId(); const fieldId = id ?? generated;
  return <div className="hl-field"><label htmlFor={fieldId}>{label}</label><input {...props} id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-detail`} /><div id={`${fieldId}-detail`} className="hl-field-detail">{hint && <span>{hint}</span>}{error && <span className="hl-field-error">{error}</span>}{counter && <span className="hl-counter">{counter.value} / {counter.max}</span>}</div></div>;
}
export function TextArea({ label, hint, error, counter, id, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Details) {
  const generated = useId(); const fieldId = id ?? generated;
  return <div className="hl-field"><label htmlFor={fieldId}>{label}</label><textarea {...props} id={fieldId} aria-invalid={!!error} aria-describedby={`${fieldId}-detail`} /><div id={`${fieldId}-detail`} className="hl-field-detail">{hint && <span>{hint}</span>}{error && <span className="hl-field-error">{error}</span>}{counter && <span className="hl-counter">{counter.value} / {counter.max}</span>}</div></div>;
}
