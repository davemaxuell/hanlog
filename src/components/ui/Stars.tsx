'use client';
import { useId } from 'react';
export function Stars({ label, value, onChange }: { label: string; value: number | null; onChange?: (value: number) => void }) {
  const group = useId();
  if (!onChange) return <div className="hl-stars-read" role="img" aria-label={`${label}: ${value ?? 0} out of 5`}><span aria-hidden="true">{'★'.repeat(value ?? 0)}{'☆'.repeat(5 - (value ?? 0))}</span><span aria-hidden="true" className="hl-caption">{label} · {value ?? 0}/5</span></div>;
  return <fieldset className="hl-star-field" role="radiogroup" aria-label={label}><legend>{label}</legend><div className="hl-stars">{[1, 2, 3, 4, 5].map(n => <label key={n} className={value === n ? 'is-selected' : ''}><input type="radio" name={group} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} checked={value === n} onChange={() => onChange(n)} /><span aria-hidden="true">{n} ★</span></label>)}</div></fieldset>;
}
