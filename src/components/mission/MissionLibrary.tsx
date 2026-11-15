'use client';
import { useUrlQuery } from '@/lib/ui/use-url-query';
import type { MissionWithProgress } from '@/lib/contracts';
import { MissionCard } from './MissionCard';
import styles from './learning.module.css';

export function MissionLibrary({ missions, savedMissionIds, savingId, canSave = true, onToggleSaved }: {
  missions: MissionWithProgress[]; savedMissionIds: string[]; savingId?: string | null; canSave?: boolean; onToggleSaved(id: string, saved: boolean): void;
}) {
  const { params, update } = useUrlQuery();
  const query = params.get('q') ?? ''; const topic = params.get('topic') ?? 'all'; const level = params.get('level') ?? 'all';
  const mode = params.get('mode') ?? 'all'; const status = params.get('status') ?? 'all'; const savedOnly = params.get('saved') === '1';
  const setQuery = (value: string) => update({ q: value }); const setTopic = (value: string) => update({ topic: value === 'all' ? null : value });
  const setLevel = (value: string) => update({ level: value === 'all' ? null : value }); const setMode = (value: string) => update({ mode: value === 'all' ? null : value });
  const setStatus = (value: string) => update({ status: value === 'all' ? null : value });
  const topics = [...new Set(missions.flatMap(m => m.tags))].sort();
  const saved = new Set(savedMissionIds);
  const needle = query.trim().normalize('NFC').toLocaleLowerCase();
  const filtered = missions.filter(m => (!needle || [m.korean, m.meaningEn, m.romanization, ...m.tags].join(' ').normalize('NFC').toLocaleLowerCase().includes(needle))
    && (topic === 'all' || m.tags.includes(topic)) && (level === 'all' || m.level === Number(level)) && (mode === 'all' || m.mode === mode)
    && (status === 'all' || (status === 'new' && m.bestOverall === null) || (status === 'practised' && m.bestOverall !== null) || (status === 'review' && m.bestOverall !== null && m.bestOverall < 80) || (status === 'strong' && m.bestOverall !== null && m.bestOverall >= 80))
    && (!savedOnly || saved.has(m.id)));
  const clear = () => update({ q: null, topic: null, level: null, mode: null, status: null, saved: null });
  return <div className="hl-stack">
    <div className={styles.filters}><label className={styles.search}>Search missions<input type="search" placeholder="Try café, thank you, or 고마워요" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className={styles.filterRow}>
        <label>Topic<select value={topic} onChange={e => setTopic(e.target.value)}><option value="all">All topics</option>{topics.map(tag => <option key={tag} value={tag}>{tag}</option>)}</select></label>
        <label>Level<select value={level} onChange={e => setLevel(e.target.value)}><option value="all">Every level</option><option value="1">1 · Get started</option><option value="2">2 · Say more</option><option value="3">3 · Make it yours</option></select></label>
        <label>Practice type<select value={mode} onChange={e => setMode(e.target.value)}><option value="all">Both types</option><option value="repeat">Say the sentence</option><option value="use">Use an expression</option></select></label>
        <label>Practice status<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All expressions</option><option value="new">Not tried yet</option><option value="practised">Practised</option><option value="review">Worth another try</option><option value="strong">Strong result · 80+</option></select></label>
      </div><div className={styles.filterActions}><button type="button" disabled={!canSave} aria-pressed={savedOnly} onClick={() => update({ saved: savedOnly ? null : '1' })}>Saved expressions {canSave && <span aria-hidden="true">({savedMissionIds.length})</span>}</button><button type="button" className={styles.clear} onClick={clear}>Clear filters</button></div>
    </div>
    <p className={styles.resultCount} role="status">{filtered.length} of {missions.length} expressions{savedOnly ? ' · saved by you' : ''}</p>
    {filtered.length ? <ul className={styles.grid} aria-label="Mission results">{filtered.map(mission => <li key={mission.id}><MissionCard mission={mission} saved={saved.has(mission.id)} saving={!canSave || !!savingId} onToggleSaved={onToggleSaved} /></li>)}</ul> : <div className={styles.empty}><h2>No expressions match yet.</h2><p>Try a different word or clear your filters to find your next conversation starter.</p></div>}
  </div>;
}
