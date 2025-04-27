import React from 'react';
import { View, StyleSheet, Image, ViewStyle, StyleProp } from 'react-native';

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
  
  return (
    <View style={[styles.container, { width, height, backgroundColor }, style]}>
      <Image 
        source={imageSource} 
        style={styles.image}
        resizeMode="contain"
      />
    </View>
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
  image: {
    width: '100%',
    height: '100%',
  },
}); 