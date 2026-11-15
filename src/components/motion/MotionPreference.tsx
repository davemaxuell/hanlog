'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'hl_motion_reduced';
type MotionState = { reduced: boolean; systemReduced: boolean; toggle(): void };
const MotionContext = createContext<MotionState | null>(null);
export function useMotionPreference() { return useContext(MotionContext); }

export function MotionProvider({ children }: { children: ReactNode }) {
  // The server renders a still page. Motion is enabled only after preferences load.
  const [state, setState] = useState({ reduced: true, systemReduced: false });
  const preference = useRef(false); const device = useRef(false);
  const apply = useCallback(() => {
    const reduced = preference.current || device.current;
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
    setState({ reduced, systemReduced: device.current });
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    try { preference.current = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Storage is optional. */ }
    const updateDevice = () => { device.current = media?.matches ?? false; apply(); };
    const updateTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      preference.current = event.key === STORAGE_KEY && event.newValue === 'true'; apply();
    };
    updateDevice(); media?.addEventListener('change', updateDevice); window.addEventListener('storage', updateTab);
    return () => { media?.removeEventListener('change', updateDevice); window.removeEventListener('storage', updateTab); };
  }, [apply]);
  const toggle = useCallback(() => {
    if (device.current) return;
    preference.current = !preference.current;
    try { if (preference.current) localStorage.setItem(STORAGE_KEY, 'true'); else localStorage.removeItem(STORAGE_KEY); } catch { /* Keep the preference for this open tab. */ }
    apply();
  }, [apply]);
  return <MotionContext.Provider value={{ ...state, toggle }}>{children}</MotionContext.Provider>;
}

export function MotionToggle({ className = '', disabled = false }: { className?: string; disabled?: boolean }) {
  const motion = useMotionPreference();
  if (!motion) return null;
  return <button type="button" className={`hl-motion-toggle ${className}`} aria-label="Reduce animations" aria-pressed={motion.reduced} disabled={disabled || motion.systemReduced} onClick={motion.toggle} title={motion.systemReduced ? 'Reduced animations follow your device settings.' : 'Choose a calmer, still interface.'}>
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 10c3-6 5 6 8 0s5 6 6 0M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
    <span>Reduce animations</span>
  </button>;
}
