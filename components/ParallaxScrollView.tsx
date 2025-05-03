import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: string;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const bottom = useBottomTabOverflow();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: bottom }}>
        <View
          style={[
            styles.header,
            { backgroundColor: headerBackgroundColor },
          ]}>
          {headerImage}
        </View>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
  },
});
