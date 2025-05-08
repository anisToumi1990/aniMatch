import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Ellipse, Path, Defs, Pattern, Rect, G } from 'react-native-svg';

interface BackgroundPatternProps {
  children: React.ReactNode;
}

export function BackgroundPattern({ children }: BackgroundPatternProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
        style={styles.gradient}
      />
      <Svg style={styles.pattern} width="100%" height="100%">
        <Defs>
          <Pattern
            id="pawprint"
            patternUnits="userSpaceOnUse"
            width="150"
            height="150"
            patternTransform="scale(1)"
          >
            <G opacity={0.1}>
              {/* Toe pads */}
              <Ellipse cx="40" cy="20" rx="6" ry="8" fill="#000" />
              <Ellipse cx="60" cy="20" rx="6" ry="9" fill="#000" />
              <Ellipse cx="30" cy="35" rx="5" ry="7" fill="#000" />
              <Ellipse cx="70" cy="35" rx="5" ry="7" fill="#000" />

              {/* Main pad */}
              <Path
                d="M40,55 
                  C35,65 45,75 50,75 
                  C55,75 65,65 60,55 
                  C57,48 43,48 40,55 
                  Z"
                fill="#000"
              />
            </G>
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#pawprint)" />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  pattern: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
