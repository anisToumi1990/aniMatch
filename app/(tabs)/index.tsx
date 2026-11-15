import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import React, { useState } from 'react';
import { useQuiz } from '../../context/QuizContext';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundPattern } from '../../components/BackgroundPattern';
import { AccountModal } from '@/components/AccountModal';
import { AuraDetailsModal } from '@/components/AuraDetailsModal';
import { AURA_IMAGES, AuraImage } from '@/constants/AuraImages';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isQuizComplete } = useQuiz();

  // Get the user's full name from user metadata
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const userInitial = fullName.charAt(0).toUpperCase();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [selectedAura, setSelectedAura] = useState<AuraImage | null>(null);
  
  function handleStartQuiz() {
    if (isQuizComplete) {
      router.push('/(tabs)/results');
      return;
    }
    router.push('/(tabs)/quiz');
  }

  return (
    <BackgroundPattern>
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'AniMatch',
            headerShown: true,
            headerStyle: {
              backgroundColor: 'transparent',
            },
            headerTransparent: true,
            headerTintColor: '#2E7D32',
            headerRight: () => (
              <TouchableOpacity
                style={styles.userInitialButton}
                onPress={() => setShowAccountModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Open account menu"
              >
                <Image source={require('../../assets/images/avatar.png')} style={styles.avatarImage} resizeMode="cover" />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.auraCard}>
            <View style={styles.titleContainer}>
              <ThemedText type="title" style={{ textAlign: 'center' }}>
                Welcome to{'\n'}
                🐾 AniMatch 🐾
              </ThemedText>
            </View>
            
            <View style={styles.descriptionContainer}>
              <ThemedText style={styles.descriptionText}>
                Discover your unique animal aura and unlock deeper connections.
              </ThemedText>
              <ThemedText style={styles.descriptionText}>
                Take our quick 10-question quiz to find out which animal reflects your personality – and explore how you vibe with others.
              </ThemedText>
            </View>

            <View style={styles.carouselContainer}>
              <ThemedText type="subtitle" style={styles.carouselTitle}>👇 Meet the Auras 👇</ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselContent}
              >
                {AURA_IMAGES.map(aura => (
                  <TouchableOpacity
                    key={aura.name}
                    onPress={() => setSelectedAura(aura)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`See the ${aura.name} aura's personality`}
                  >
                    <Image
                      source={aura.source}
                      style={styles.carouselImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.quizButtonContainer}>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={handleStartQuiz}
                style={styles.quizButton}
              >
                <Text style={styles.quizButtonText}>Start the Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <AccountModal 
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
        />
        <AuraDetailsModal
          aura={selectedAura}
          onClose={() => setSelectedAura(null)}
        />
      </SafeAreaView>
    </BackgroundPattern>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  auraCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleContainer: {
    marginBottom: 20,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  carouselContainer: {
    marginTop: 16,
  },
  carouselTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 18,
  },
  carouselContent: {
    paddingVertical: 8,
  },
  carouselImage: {
    width: 80,
    height: 80,
    marginHorizontal: 8,
    borderRadius: 30,
  },
  userInitialButton: {
    width: 50,
    height: 50,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 5,
  },
  quizButtonContainer: {
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizButton: {
    backgroundColor: '#388e3c',
    borderRadius: 32,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    minWidth: 260,
  },
  quizButtonText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
