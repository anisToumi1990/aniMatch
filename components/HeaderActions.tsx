import React, { useState } from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { AccountModal } from '@/components/AccountModal';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { getDisplayName } from '@/lib/names';

interface HeaderActionsProps {
  style?: StyleProp<ViewStyle>;
  /** Extra buttons shown before the bell (e.g. Compatibility's share button). */
  children?: React.ReactNode;
}

/** Right side of every tab header: notification bell + account button (opens AccountModal). */
export function HeaderActions({ style, children }: HeaderActionsProps) {
  const { user } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const userInitial = getDisplayName(user?.user_metadata?.full_name, user?.email).charAt(0).toUpperCase();

  return (
    <View style={[styles.container, style]}>
      {children}
      <NotificationBell />
      <TouchableOpacity
        style={styles.accountButton}
        onPress={() => setIsAccountOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Open account menu"
      >
        <ThemedText style={styles.accountInitial}>{userInitial}</ThemedText>
      </TouchableOpacity>
      <AccountModal visible={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInitial: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
});
