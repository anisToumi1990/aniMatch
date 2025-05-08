import { View, Text, StyleSheet, TouchableOpacity, Platform, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import React, { useState } from 'react';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BackgroundPattern } from '../../components/BackgroundPattern';
import { AccountModal } from '@/components/AccountModal';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Get the user's full name from user metadata
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const userInitial = fullName.charAt(0).toUpperCase();

  const [showAccountModal, setShowAccountModal] = useState(false);
  
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
                <Image 
                  source={require('../../assets/auras/png/bear.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/cat.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/deer.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/dolphin.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/eagle.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/elephant.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/fox.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/lion.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/otter.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/owl.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/parrot.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/peacock.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/snake.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/unicorn.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                />
                <Image 
                  source={require('../../assets/auras/png/wolf.png')} 
                  style={styles.carouselImage}
                  resizeMode="contain"
                /> 
              </ScrollView>
            </View>
          </View>
        </ScrollView>
        <AccountModal 
          visible={showAccountModal}
          onClose={() => setShowAccountModal(false)}
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
});
