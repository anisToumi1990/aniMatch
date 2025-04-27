import React, { useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuiz } from '@/context/QuizContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AnimalIcon } from '@/components/AnimalIcon';

export default function ResultsScreen() {
  const router = useRouter();
  const { animalAura, resetQuiz, isQuizComplete } = useQuiz();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
          title: 'Your Animal Aura',
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
      await Share.share({
        message: `I discovered my Animal Aura is ${animalAura.name}! ${animalAura.description} #AniMatch`,
      });
    } catch (error) {
      console.error('Error sharing result:', error);
    }
  };

  const handleRetakeQuiz = () => {
    resetQuiz();
    router.navigate("/(tabs)");
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ 
        title: 'Your Animal Aura',
        headerShown: true 
      }} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          
          <View style={[styles.auraCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
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
                      { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                    ]}
                  >
                    <ThemedText style={styles.traitText}>
                      {trait.trim()}
                    </ThemedText>
                  </View>
                ))}
              </View>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingTop: 10,
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
    fontSize: 14,
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
    paddingHorizontal: 5,
    paddingVertical: 0,
    borderRadius: 16,
    margin: 3,
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
}); 