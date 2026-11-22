/**
 * Where tapping a notification goes. Pure (no Supabase import) so it can be
 * unit-tested.
 */

/** In-app routes a notification may open. Anything else is ignored. */
export const NOTIFICATION_ROUTES = {
  compatibility: '/compatibility',
  invites: '/invites',
} as const;

export type NotificationRoute = (typeof NOTIFICATION_ROUTES)[keyof typeof NOTIFICATION_ROUTES];

/**
 * Params the Compatibility screen understands to open one match:
 * `resultId` (compatibility_results.id), else `withUser` + `relationshipType`
 * (the match with that person for that type, e.g. from an invite_accepted row).
 */
// A type alias (not an interface) so expo-router accepts it as route params.
export type MatchLinkParams = {
  resultId?: string;
  withUser?: string;
  relationshipType?: string;
};

export interface NotificationTarget {
  pathname: NotificationRoute;
  params?: MatchLinkParams;
}

/** The fields of a notification this needs. */
export interface NotificationLinkSource {
  type: string | null;
  link: string | null;
  actor_id: string | null;
  invite_id: number | null;
  data: {
    compatibility_result_id?: number | null;
    relationship_type?: string | null;
  } | null;
}

const KNOWN_ROUTES: string[] = Object.values(NOTIFICATION_ROUTES);

/** Params that open the exact match behind a match_ready / invite_accepted row, or undefined. */
function getMatchParams(notification: NotificationLinkSource): MatchLinkParams | undefined {
  if (notification.type !== 'match_ready' && notification.type !== 'invite_accepted') return undefined;
  const resultId = notification.data?.compatibility_result_id;
  if (resultId !== null && resultId !== undefined) return { resultId: String(resultId) };
  const relationshipType = notification.data?.relationship_type;
  if (notification.actor_id && relationshipType) {
    return { withUser: notification.actor_id, relationshipType };
  }
  return undefined;
}

/**
 * The route to open for a notification, or null if it has none we know.
 * Match notifications open that match's detail; rows without enough data
 * just open the Compatibility list.
 */
export function getNotificationTarget(notification: NotificationLinkSource): NotificationTarget | null {
  if (notification.link && KNOWN_ROUTES.includes(notification.link)) {
    const pathname = notification.link as NotificationRoute;
    if (pathname !== NOTIFICATION_ROUTES.compatibility) return { pathname };
    const params = getMatchParams(notification);
    return params ? { pathname, params } : { pathname };
  }
  // Older invite rows have no link.
  if (notification.invite_id) return { pathname: NOTIFICATION_ROUTES.invites };
  return null;
}
