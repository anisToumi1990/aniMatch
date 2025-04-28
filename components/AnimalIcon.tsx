import React, { useRef } from 'react';
import { View, StyleSheet, Image, ViewStyle, StyleProp, TouchableOpacity, Animated } from 'react-native';

interface AnimalIconProps {
  animalName: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimalIcon({ 
  animalName, 
  width = 100, 
  height = 100,
  backgroundColor = 'transparent',
  style
}: AnimalIconProps) {
  // Convert animal name to lowercase for consistent file naming
  const animalNameLower = animalName.toLowerCase();
  
  // Define the image source dynamically based on animal name
  const imageSource = getAnimalImageSource(animalNameLower);
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Handle press animation
  const handlePress = () => {
    // Reset animations
    Animated.parallel([
      // Scale animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),
      // Rotation animation
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };
  
  // Interpolate rotation
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <TouchableOpacity 
      activeOpacity={0.8} 
      onPress={handlePress}
      style={[styles.container, { width, height, backgroundColor }, style]}
    >
      <Animated.View 
        style={[
          styles.imageContainer,
          { 
            transform: [
              { scale: scaleAnim },
              { rotate: spin }
            ] 
          }
        ]}
      >
        <Image 
          source={imageSource} 
          style={styles.image}
          resizeMode="contain"
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// Helper function to get the correct image source based on animal name
function getAnimalImageSource(animalName: string) {
  switch (animalName) {
    case 'owl':
      return require('../assets/auras/png/owl.png');
    case 'otter':
      return require('../assets/auras/png/otter.png');
    case 'deer':
      return require('../assets/auras/png/deer.png');
    case 'eagle':
      return require('../assets/auras/png/eagle.png');
    case 'cat':
      return require('../assets/auras/png/cat.png');
    case 'snake':
      return require('../assets/auras/png/snake.png');
    case 'elephant':
      return require('../assets/auras/png/elephant.png');
    case 'unicorn':
      return require('../assets/auras/png/unicorn.png');
    case 'bear':
      return require('../assets/auras/png/bear.png');
    case 'wolf':
      return require('../assets/auras/png/wolf.png');
    case 'parrot':
      return require('../assets/auras/png/parrot.png');
    case 'fox':
      return require('../assets/auras/png/fox.png');
    case 'lion':
      return require('../assets/auras/png/lion.png');
    case 'peacock':
      return require('../assets/auras/png/peacock.png');
    case 'dolphin':
      return require('../assets/auras/png/dolphin.png');
    default:
      // If no matching animal is found, use a default image
      return require('../assets/auras/png/owl.png');
  }
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    overflow: 'hidden',
    padding: 5,
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
}); 