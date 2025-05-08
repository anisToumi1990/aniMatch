import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Share, Platform, Image, Modal, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { AnimalIcon } from '@/components/AnimalIcon';
import { captureRef } from 'react-native-view-shot';
import { BackgroundPattern } from '../../components/BackgroundPattern';
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
          title: 'Animal Aura',
          headerShown: true
        }} />
        <ThemedView style={styles.loadingContainer}>
          <ThemedText>Loading your result...</ThemedText>
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

  // Function to get category color
  const getCategoryColor = () => {
    switch (animalAura.category) {
      case 'Extroverted/Social':
        return '#FFB74D'; // Orange
      case 'Balanced/Adaptive':
        return '#64B5F6'; // Blue
      case 'Introverted/Strategic':
        return '#81C784'; // Green
      default:
        return '#7E4EFF'; // Purple (default)
    }
  };

  return (
    <BackgroundPattern>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Animal Aura',
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTransparent: true,
            headerTintColor: '#2E7D32',
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
              style={[styles.auraCard]}
            >
              <View style={styles.iconWrapper}>
                <AnimalIcon 
                  animalName={animalAura.name}
                  width={100}
                  height={100}
                />
              </View>
              
              <ThemedText style={styles.auraName}>
                {animalAura.name}
              </ThemedText>
              
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor() }]}>
                <ThemedText style={styles.categoryText}>
                  {animalAura.category.split('/')[0]}
                </ThemedText>
              </View>
              
              <ThemedText style={styles.auraDescription}>
                {animalAura.description}
              </ThemedText>
              
              <View style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Strengths</ThemedText>
                <ThemedText style={styles.sectionContent}>
                  {animalAura.strengths}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Challenges</ThemedText>
                <ThemedText style={styles.sectionContent}>
                  {animalAura.challenges}
                </ThemedText>
              </View>
              
              <View style={styles.sectionContainer}>
                <ThemedText style={styles.sectionTitle}>Key Traits</ThemedText>
                <View style={styles.traitsContainer}>
                  {animalAura.traits.split(',').map((trait, index) => (
                    <View 
                      key={index} 
                      style={[
                        styles.traitBadge, 
                        { backgroundColor: '#F2F2F7' }
                      ]}
                    >
                      <ThemedText style={styles.traitText}>
                        {trait.trim()}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </View>
              
              {/* Add AniMatch branding */}
              <View style={styles.brandingContainer}>
                <ThemedText style={styles.brandingText}>AniMatch</ThemedText>
              </View>
            </View>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.shareButton]} 
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>Share Result</ThemedText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.retakeButton]} 
                onPress={handleRetakeQuiz}
              >
                <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.buttonText}>Retake Quiz</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </BackgroundPattern>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  auraCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 20,
  },
  auraIcon: {
    width: 70,
    height: 70,
  },
  auraName: {
    fontSize: 25,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  auraDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  sectionContainer: {
    width: '100%',
    marginBottom: 20,
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
    marginTop: 0,
  },
  traitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    margin: 5,
  },
  traitText: {
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 24,
    flex: 1,
    marginHorizontal: 8,
  },
  shareButton: {
    backgroundColor: '#38B6FF',
  },
  retakeButton: {
    backgroundColor: '#7E4EFF',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  brandingContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DDD',
    width: '100%',
    alignItems: 'center',
  },
  brandingText: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#7E4EFF20', // Purple with 20% opacity
    justifyContent: 'center',
  },
  welcomeBackText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
}); 