import { supabase } from '@/lib/supabase';
import {
  NotificationData,
  NotificationText,
  getNotificationText,
  isNotificationType,
} from '@/constants/notificationCopy';

/** A row of the notifications table, as the app reads it. */
export interface AppNotification {
  /** bigint in the database. */
  id: number;
  user_id: string;
  /** invite_received | invite_accepted | match_ready (null on rows from before the migration). */
  type: string | null;
  title: string | null;
  body: string | null;
  /** Legacy text column, still filled for the invites screen. */
  message: string | null;
  /** In-app route, e.g. "/compatibility" or "/invites". */
  link: string | null;
  actor_id: string | null;
  data: NotificationData | null;
  invite_id: number | null;
  read_at: string | null;
  created_at: string;
}

const NOTIFICATION_COLUMNS = 'id, user_id, type, title, body, message, link, actor_id, data, invite_id, read_at, created_at';

export { NOTIFICATION_ROUTES, getNotificationTarget } from '@/lib/notificationRoutes';
export type { NotificationRoute, NotificationTarget } from '@/lib/notificationRoutes';

/** Text to show, from constants/notificationCopy.ts when the type is known. */
export function getDisplayText(notification: AppNotification): NotificationText {
  if (isNotificationType(notification.type)) {
    return getNotificationText(notification.type, notification.data ?? {});
  }
  return {
    title: notification.title || 'Notification',
    body: notification.body || notification.message || '',
  };
}

/** Latest notifications for the user, newest first. */
export async function fetchNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

/** Number of notifications the user hasn't read yet. */
export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Number of invite notifications whose invite is still pending (the badge on
 * the Invites tab). Read or not doesn't matter: the invite still needs an answer.
 */
export async function fetchPendingInviteCount(userId: string): Promise<number> {
  const { data: rows, error } = await supabase
    .from('notifications')
    .select('invite_id')
    .eq('user_id', userId)
    .not('invite_id', 'is', null);
  if (error) throw error;

  const inviteIds = Array.from(new Set((rows ?? []).map((row: { invite_id: number }) => row.invite_id)));
  if (inviteIds.length === 0) return 0;

  const { count, error: invitesError } = await supabase
    .from('invites')
    .select('id', { count: 'exact', head: true })
    .in('id', inviteIds)
    .eq('status', 'pending');
  if (invitesError) throw invitesError;
  return count ?? 0;
}

/** Marks one notification as read. `is_read` is kept in sync for the invites screen. */
export async function markNotificationRead(notificationId: number): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString(), is_read: true }, { returning: 'minimal' })
    .eq('id', notificationId)
    .is('read_at', null);
  if (error) throw error;
}

/** Marks every unread notification of the user as read. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString(), is_read: true }, { returning: 'minimal' })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}
