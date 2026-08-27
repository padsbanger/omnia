import { describe, expect, it } from 'vitest';
import { MAX_UNREAD_COUNT } from '../../common/utils/extractUnreadFromTitle';
import {
  parseUnreadTrackerMessage,
  UNREAD_TRACKER_CONSOLE_PREFIX,
} from './unreadTracker';

describe('parseUnreadTrackerMessage', () => {
  const message = (payload: unknown) =>
    `${UNREAD_TRACKER_CONSOLE_PREFIX}${JSON.stringify(payload)}`;

  it('returns null for unrelated, malformed, or invalid messages', () => {
    expect(parseUnreadTrackerMessage('ordinary console message')).toBeNull();
    expect(
      parseUnreadTrackerMessage(`${UNREAD_TRACKER_CONSOLE_PREFIX}{`),
    ).toBeNull();
    expect(parseUnreadTrackerMessage(message({ count: '3' }))).toBeNull();
    expect(parseUnreadTrackerMessage(message({ count: Number.NaN }))).toBeNull();
  });

  it('normalizes a count and retains an explicit source', () => {
    expect(
      parseUnreadTrackerMessage(message({ count: 4.8, source: 'gmail-dom' })),
    ).toEqual({ count: 4, source: 'gmail-dom' });
  });

  it('clamps counts and supplies the default DOM source', () => {
    expect(parseUnreadTrackerMessage(message({ count: -4 }))).toEqual({
      count: 0,
      source: 'dom',
    });
    expect(
      parseUnreadTrackerMessage(message({ count: MAX_UNREAD_COUNT + 1 })),
    ).toEqual({ count: MAX_UNREAD_COUNT, source: 'dom' });
  });
});
