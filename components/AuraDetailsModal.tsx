import React, { useCallback, useEffect, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  ImageSourcePropType,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from './ThemedView';
import { splitTraits } from '@/lib/traits';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { AuraAvatar } from './AuraAvatar';
import { AuraButton } from './AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { AnimalAura, fetchAnimalAuraByName } from '@/lib/supabase/quiz';

interface AuraDetailsModalProps {
  /** The aura to show, or null when the popup is closed. */
  aura: { name: string; source: ImageSourcePropType } | null;
  onClose: () => void;
}

interface State {
  details: AnimalAura | null;
  isLoading: boolean;
  hasError: boolean;
}

type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; details: AnimalAura }
  | { type: 'FETCH_ERROR' };

const initialState: State = { details: null, isLoading: false, hasError: false };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { details: null, isLoading: true, hasError: false };
    case 'FETCH_SUCCESS':
      return { details: action.details, isLoading: false, hasError: false };
    case 'FETCH_ERROR':
      return { details: null, isLoading: false, hasError: true };
    default:
      return state;
  }
}

export function AuraDetailsModal({ aura, onClose }: AuraDetailsModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reloadCount, setReloadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const auraName = aura?.name ?? null;
  const auraColor = getAuraColor(auraName);

  useEffect(() => {
    if (!auraName) return;
    let isCancelled = false;

    dispatch({ type: 'FETCH_START' });
    fetchAnimalAuraByName(auraName)
      .then(details => {
        if (isCancelled) return;
        if (!details) {
          console.error(`No animal aura found with name "${auraName}"`);
          dispatch({ type: 'FETCH_ERROR' });
          return;
        }
        dispatch({ type: 'FETCH_SUCCESS', details });
      })
      .catch(() => {
        if (!isCancelled) dispatch({ type: 'FETCH_ERROR' });
      });

    return () => {
      isCancelled = true;
    };
  }, [auraName, reloadCount]);

  const handleRetry = useCallback(() => setReloadCount(count => count + 1), []);

  // The popup closes only with the X button, so Android back / web Escape do nothing.
  const ignoreRequestClose = useCallback(() => {}, []);

  return (
    <Modal
      visible={aura !== null}
      transparent
      animationType="slide"
      onRequestClose={ignoreRequestClose}
    >
      <View
        style={[
          styles.modalOverlay,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <ThemedView style={[styles.modalContent, { borderColor: withAlpha(auraColor, 0.35) }]}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close aura details"
            hitSlop={8}
          >
            <Ionicons name="close" size={28} color={textColor} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {aura && (
              <View style={styles.header}>
                <AuraAvatar animalName={aura.name} size="large" style={styles.avatar} />
                <ThemedText style={styles.nameText} accessibilityRole="header">
                  {state.details?.name ?? aura.name}
                </ThemedText>
                {state.details?.category ? (
                  <ThemedText style={[styles.categoryText, { color: auraColor }]}>{state.details.category}</ThemedText>
                ) : null}
              </View>
            )}

            {state.isLoading && (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="large" color={Colors.textSecondary} />
                <ThemedText type="secondary" style={styles.statusText}>Loading personality…</ThemedText>
              </View>
            )}

            {state.hasError && (
              <View style={styles.statusContainer}>
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  We couldn&apos;t load this aura right now. Please check your connection and try again.
                </ThemedText>
                <AuraButton label="Try again" variant="secondary" onPress={handleRetry} />
              </View>
            )}

            {state.details && (
              <>
                <ThemedText type="secondary" style={styles.description}>{state.details.description}</ThemedText>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                    <ThemedText style={styles.sectionTitle}>Traits</ThemedText>
                  </View>
                  <View style={styles.traitsContainer}>
                    {splitTraits(state.details.traits).map(trait => (
                      <View
                        key={trait}
                        style={[
                          styles.traitBadge,
                          { borderColor: withAlpha(auraColor, 0.45), backgroundColor: withAlpha(auraColor, 0.1) },
                        ]}
                      >
                        <ThemedText style={[styles.traitText, { color: auraColor }]}>{trait}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                    <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                  </View>
                  <ThemedText type="secondary" style={styles.sectionContent}>{state.details.strengths}</ThemedText>
                </View>

                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                    <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                  </View>
                  <ThemedText type="secondary" style={styles.sectionContent}>{state.details.challenges}</ThemedText>
                </View>
              </>
            )}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    width: '90%',
    maxWidth: 420,
    maxHeight: '100%',
    marginHorizontal: 20,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
    zIndex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 16,
  },
  nameText: {
    fontSize: 26,
    fontWeight: '500',
    lineHeight: 32,
  },
  categoryText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 14,
  },
  statusText: {
    fontSize: 15,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 8,
  },
  section: {
    width: '100%',
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionMarker: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 23,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  traitText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
