import { expect, it } from 'vitest';
import { parseReportCommand } from '../../scripts/review-community-reports';
it('keeps operator changes dry-run unless explicitly applied', () => {
  const id = 'f260fa5a-4450-4314-a410-a4cc17ee78c0';
  expect(parseReportCommand(['review', id, 'dismissed'])).toEqual({ action: 'review', id, decision: 'dismissed', apply: false });
  expect(parseReportCommand(['review', id, 'actioned', '--apply'])).toMatchObject({ apply: true });
  expect(parseReportCommand(['list'])).toEqual({ action: 'list', status: 'open', limit: 20 });
});
it('rejects unbounded, ambiguous, or malformed operator commands before connecting', () => {
  for (const args of [['list', '--limit=0'], ['list', '--limit=101'], ['list', '--status=all'], ['list', '--limit=20', '--limit=5'], ['review', 'bad', 'dismissed'], ['review', 'f260fa5a-4450-4314-a410-a4cc17ee78c0', 'delete', '--apply']]) expect(() => parseReportCommand(args)).toThrow();
});
