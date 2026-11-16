import styles from './learning.module.css';

export function PracticeWeek({ days }: { days: { date: string; attempts: number }[] }) {
  return <ol className={styles.week} aria-label="Practice over the last seven days">{days.map((day, index) => {
    const date = new Date(`${day.date}T12:00:00+09:00`);
    const label = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'Asia/Seoul' }).format(date);
    const fullDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'Asia/Seoul' }).format(date);
    return <li key={day.date} style={{ ['--day-i' as string]: index }} aria-label={`${fullDate}: ${day.attempts} ${day.attempts === 1 ? 'attempt' : 'attempts'}${index === days.length - 1 ? ', today' : ''}`}><span className={styles.day} data-active={day.attempts > 0} data-today={index === days.length - 1} aria-hidden="true">{day.attempts || '·'}</span><span aria-hidden="true">{index === days.length - 1 ? 'Today' : label}</span></li>;
  })}</ol>;
}
