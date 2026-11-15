import React, { useCallback, useEffect, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
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

function splitTraits(traits: string): string[] {
  return traits
    .split(',')
    .map(trait => trait.trim())
    .filter(Boolean);
}

export function AuraDetailsModal({ aura, onClose }: AuraDetailsModalProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reloadCount, setReloadCount] = useState(0);
  const insets = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const auraName = aura?.name ?? null;

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
        <ThemedView style={styles.modalContent}>
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
                <View style={styles.imageContainer}>
                  <Image source={aura.source} style={styles.image} resizeMode="contain" />
                </View>
                <ThemedText style={styles.nameText} accessibilityRole="header">
                  {state.details?.name ?? aura.name}
                </ThemedText>
                {state.details?.category ? (
                  <ThemedText style={styles.categoryText}>{state.details.category}</ThemedText>
                ) : null}
              </View>
            )}

            {state.isLoading && (
              <View style={styles.statusContainer}>
                <ActivityIndicator size="large" color={tintColor} />
                <ThemedText style={styles.statusText}>Loading personality…</ThemedText>
              </View>
            )}

            {state.hasError && (
              <View style={styles.statusContainer}>
                <ThemedText style={styles.errorText} accessibilityRole="alert">
                  We couldn&apos;t load this aura right now. Please check your connection and try again.
                </ThemedText>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                  accessibilityRole="button"
                >
                  <ThemedText style={styles.retryText}>Try again</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            {state.details && (
              <>
                <ThemedText style={styles.description}>{state.details.description}</ThemedText>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Traits</ThemedText>
                  <View style={styles.traitsContainer}>
                    {splitTraits(state.details.traits).map(trait => (
                      <View key={trait} style={styles.traitBadge}>
                        <ThemedText style={styles.traitText}>{trait}</ThemedText>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                  <ThemedText style={styles.sectionContent}>{state.details.strengths}</ThemedText>
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                  <ThemedText style={styles.sectionContent}>{state.details.challenges}</ThemedText>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '100%',
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
  },
  categoryText: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.6,
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  statusText: {
    fontSize: 16,
    opacity: 0.7,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  section: {
    width: '100%',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitBadge: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4f46e5',
    backgroundColor: 'rgba(79, 70, 229, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  traitText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '500',
  },
});
