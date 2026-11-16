/** "energetic" -> "Energetic". Only the first letter changes. */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Splits `animal_auras.traits` (one comma-separated string) into chip labels:
 * trimmed, empty entries dropped, first letter capitalized.
 */
export function splitTraits(traits: string | null | undefined): string[] {
  if (!traits) return [];
  return traits
    .split(',')
    .map(trait => trait.trim())
    .filter(Boolean)
    .map(capitalizeFirst);
}
