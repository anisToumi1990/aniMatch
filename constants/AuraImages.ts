import type { ImageSourcePropType } from 'react-native';

export interface AuraImage {
  /** Matches `animal_auras.name` in Supabase (case-insensitive). */
  name: string;
  source: ImageSourcePropType;
}

/** Auras shown in the "Meet the Auras" carousel, in display order. */
export const AURA_IMAGES: AuraImage[] = [
  { name: 'Bear', source: require('../assets/auras/png/bear.png') },
  { name: 'Cat', source: require('../assets/auras/png/cat.png') },
  { name: 'Deer', source: require('../assets/auras/png/deer.png') },
  { name: 'Dolphin', source: require('../assets/auras/png/dolphin.png') },
  { name: 'Eagle', source: require('../assets/auras/png/eagle.png') },
  { name: 'Elephant', source: require('../assets/auras/png/elephant.png') },
  { name: 'Fox', source: require('../assets/auras/png/fox.png') },
  { name: 'Lion', source: require('../assets/auras/png/lion.png') },
  { name: 'Otter', source: require('../assets/auras/png/otter.png') },
  { name: 'Owl', source: require('../assets/auras/png/owl.png') },
  { name: 'Parrot', source: require('../assets/auras/png/parrot.png') },
  { name: 'Peacock', source: require('../assets/auras/png/peacock.png') },
  { name: 'Snake', source: require('../assets/auras/png/snake.png') },
  { name: 'Unicorn', source: require('../assets/auras/png/unicorn.png') },
  { name: 'Wolf', source: require('../assets/auras/png/wolf.png') },
];
