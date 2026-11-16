import { MatchLevelColors } from '@/constants/Colors';

export interface MatchLevel {
  label: string;
  color: string;
}

/** 75-100: strong, 50-74: good, under 50: needs effort. */
export function getMatchLevel(score: number): MatchLevel {
  if (score >= 75) return { label: 'Strong match', color: MatchLevelColors.strong };
  if (score >= 50) return { label: 'Good match', color: MatchLevelColors.good };
  return { label: 'Needs effort', color: MatchLevelColors.needsEffort };
}

/** "business_partner" -> "Business partner" */
export function formatRelationshipType(relationshipType: string): string {
  const words = relationshipType.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "Omar Trabelsi" -> "Omar". Null when there is no usable name. */
export function getFirstName(fullName: string | null | undefined): string | null {
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName ? firstName : null;
}
