import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { Colors, MatchLevelColors } from '@/constants/Colors';
import { AREA_COPY, AREA_LABELS, CLASH_TITLE, CLICK_TITLE } from '@/constants/compatibilityCopy';
import {
  AreaHighlight,
  AreaLevel,
  AreaScores,
  COMPATIBILITY_AREAS,
  getAreaLevel,
  getClickAndClash,
} from '@/lib/compatibilityV2';

const LEVEL_COLORS: Record<AreaLevel, string> = {
  high: MatchLevelColors.strong,
  medium: MatchLevelColors.good,
  low: MatchLevelColors.needsEffort,
};

interface AreaBreakdownProps {
  areas: AreaScores;
}

/** Compatibility v2: the 4 area bars, then "Where you click" / "Where you clash". */
export function AreaBreakdown({ areas }: AreaBreakdownProps) {
  const { click, clash } = getClickAndClash(areas);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {COMPATIBILITY_AREAS.map(area => {
          const score = Math.round(areas[area]);
          const color = LEVEL_COLORS[getAreaLevel(score)];
          return (
            <View
              key={area}
              style={styles.area}
              accessible
              accessibilityLabel={`${AREA_LABELS[area]}: ${score} out of 100`}
            >
              <View style={styles.areaHeader}>
                <ThemedText type="secondary" style={styles.areaLabel} numberOfLines={1}>
                  {AREA_LABELS[area]}
                </ThemedText>
                <ThemedText style={[styles.areaValue, { color }]}>{score}</ThemedText>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: color }]} />
              </View>
            </View>
          );
        })}
      </View>

      <Highlight title={CLICK_TITLE} icon="sparkles" highlight={click} />
      {clash ? <Highlight title={CLASH_TITLE} icon="flash" highlight={clash} /> : null}
    </View>
  );
}

interface HighlightProps {
  title: string;
  icon: 'sparkles' | 'flash';
  highlight: AreaHighlight;
}

function Highlight({ title, icon, highlight }: HighlightProps) {
  const color = LEVEL_COLORS[highlight.level];
  return (
    <View style={styles.highlight}>
      <View style={styles.highlightHeader}>
        <Ionicons name={icon} size={12} color={color} />
        <ThemedText style={styles.highlightTitle}>
          {title}
          <ThemedText type="muted" style={styles.highlightArea}>
            {' · '}
            {AREA_LABELS[highlight.area]}
          </ThemedText>
        </ThemedText>
      </View>
      <ThemedText type="secondary" style={styles.highlightText}>
        {AREA_COPY[highlight.area][highlight.level]}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    rowGap: 10,
  },
  area: {
    flexBasis: '45%',
    flexGrow: 1,
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
    gap: 6,
  },
  areaLabel: {
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  areaValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  highlight: {
    gap: 3,
  },
  highlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  highlightTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  highlightArea: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  highlightText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
