import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Share, Platform, Image, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { AuraAvatar } from '@/components/AuraAvatar';
import { AuraButton } from '@/components/AuraButton';
import { Colors, getAuraColor, withAlpha } from '@/constants/Colors';
import { transparentHeaderOptions } from '@/constants/Theme';
import { captureRef } from 'react-native-view-shot';
import { ScreenBackground } from '@/components/ScreenBackground';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResultsScreen() {
  const router = useRouter();
  const { animalAura, resetQuiz, isQuizComplete, isPreviousResult } = useQuiz();
  const viewShotRef = useRef(null);

  // If user navigates here without completing the quiz, redirect to quiz
  useEffect(() => {
    if (!isQuizComplete || !animalAura) {
      router.replace('/(tabs)');
    }
  }, [isQuizComplete, animalAura]);

  if (!animalAura) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ 
          ...transparentHeaderOptions,
          title: 'Animal aura',
        }} />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText type="secondary">Loading your result...</ThemedText>
        </ThemedView>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    try {
      // Create a more attractive sharing message
      const shareMessage = `🌟 I discovered my Animal Aura is the ${animalAura.name}! 🌟\n\n${animalAura.description}\n\nMy key traits: ${animalAura.traits}\n\n#AniMatch #AnimalAura`;
      
      // Try to capture the result card as an image
      if (viewShotRef.current) {
        try {
          // Capture the view as an image using captureRef
          const uri = await captureRef(viewShotRef, {
            format: 'png',
            quality: 0.8,
          });
          
          // Share the image along with text
          if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // Use the Share API which works on both platforms
            await Share.share({
              message: shareMessage,
              url: uri, // iOS will use this
              title: 'My Animal Aura', // Android will use this as title
            });
          } else {
            // Fallback for web and other platforms
            await Share.share({
              message: shareMessage,
            });
          }
          return;
        } catch (error) {
          console.error('Error capturing or sharing image:', error);
        }
      }
      
      // Fallback to simple text sharing
      await Share.share({
        message: shareMessage,
      });
    } catch (error) {
      console.error('Error sharing result:', error);
    }
  };

  const handleRetakeQuiz = () => {
    // Just reset the quiz, which will trigger the directNavigateToQuiz flag
    // The tab layout will handle the navigation to avoid the home tab flash
    resetQuiz();
  };

  // Accent color for this aura, used for the badge, section markers and traits
  const auraColor = getAuraColor(animalAura.name);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            ...transparentHeaderOptions,
            title: 'Animal aura',
          }}
        />
        
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            
            {isPreviousResult && (
              <View style={styles.welcomeBackBanner}>
                <ThemedText style={styles.welcomeBackText}>
                  Welcome back! Here's your previous result.
                </ThemedText>
              </View>
            )}
            
            <View 
              ref={viewShotRef}
              style={[styles.auraCard, { borderColor: withAlpha(auraColor, 0.35) }]}
            >
              <ThemedText type="wordmark" style={styles.cardEyebrow}>YOUR AURA</ThemedText>

              <AuraAvatar animalName={animalAura.name} size="large" style={styles.avatar} />
              
              <ThemedText style={styles.auraName}>
                {animalAura.name}
              </ThemedText>
              
              <View
                style={[
                  styles.categoryBadge,
                  { borderColor: withAlpha(auraColor, 0.5), backgroundColor: withAlpha(auraColor, 0.12) },
                ]}
              >
                <ThemedText style={[styles.categoryText, { color: auraColor }]}>
                  {animalAura.category.split('/')[0]}
                </ThemedText>
              </View>
              
              <ThemedText type="secondary" style={styles.auraDescription}>
                {animalAura.description}
              </ThemedText>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                </View>
                <ThemedText type="secondary" style={styles.sectionContent}>
                  {animalAura.strengths}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                </View>
                <ThemedText type="secondary" style={styles.sectionContent}>
                  {animalAura.challenges}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionMarker, { backgroundColor: auraColor }]} />
                  <ThemedText style={styles.sectionTitle}>Key traits</ThemedText>
                </View>
                <View style={styles.traitsContainer}>
                  {animalAura.traits.split(',').map((trait, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.traitBadge, 
                        { borderColor: withAlpha(auraColor, 0.45), backgroundColor: withAlpha(auraColor, 0.1) }
                      ]}
                    >
                      <ThemedText style={[styles.traitText, { color: auraColor }]}>
                        {trait.trim()}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Add AniMatch branding */}
              <View style={styles.brandingContainer}>
                <ThemedText type="wordmark">ANIMATCH</ThemedText>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <AuraButton
                label="Share result"
                icon="share-outline"
                onPress={handleShare}
                style={styles.button}
              />
              <AuraButton
                label="Retake quiz"
                icon="refresh-outline"
                variant="secondary"
                onPress={handleRetakeQuiz}
                style={styles.button}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    padding: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auraCard: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  cardEyebrow: {
    marginBottom: 20,
  },
  avatar: {
    marginBottom: 20,
  },
  auraName: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  auraDescription: {
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 22,
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  traitText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingHorizontal: 12,
  },
  brandingContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    width: '100%',
    alignItems: 'center',
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardRaised,
    justifyContent: 'center',
  },
  welcomeBackText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
