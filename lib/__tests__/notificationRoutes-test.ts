import { getNotificationTarget, NotificationLinkSource } from '@/lib/notificationRoutes';

function notification(overrides: Partial<NotificationLinkSource>): NotificationLinkSource {
  return { type: null, link: null, actor_id: null, invite_id: null, data: null, ...overrides };
}

describe('getNotificationTarget', () => {
  it('opens the exact match of a match_ready row', () => {
    const target = getNotificationTarget(
      notification({
        type: 'match_ready',
        link: '/compatibility',
        actor_id: 'user-b',
        data: { compatibility_result_id: 42, relationship_type: 'lover' },
      }),
    );
    expect(target).toEqual({ pathname: '/compatibility', params: { resultId: '42' } });
  });

  it('opens the match with the other person for invite_accepted rows', () => {
    const target = getNotificationTarget(
      notification({
        type: 'invite_accepted',
        link: '/compatibility',
        actor_id: 'user-b',
        invite_id: 7,
        data: { relationship_type: 'family' },
      }),
    );
    expect(target).toEqual({
      pathname: '/compatibility',
      params: { withUser: 'user-b', relationshipType: 'family' },
    });
  });

  it('falls back to the list for old rows without match data', () => {
    expect(getNotificationTarget(notification({ type: 'match_ready', link: '/compatibility' }))).toEqual({
      pathname: '/compatibility',
    });
  });

  it('keeps invite links and old invite rows on /invites', () => {
    expect(getNotificationTarget(notification({ type: 'invite_received', link: '/invites', invite_id: 3 }))).toEqual({
      pathname: '/invites',
    });
    expect(getNotificationTarget(notification({ invite_id: 3 }))).toEqual({ pathname: '/invites' });
  });

  it('ignores unknown links', () => {
    expect(getNotificationTarget(notification({ link: 'https://example.com' }))).toBeNull();
  });
});
