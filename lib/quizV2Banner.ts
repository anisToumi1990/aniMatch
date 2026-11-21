import AsyncStorage from '@react-native-async-storage/async-storage';

/** Home's "New, more accurate quiz" banner: dismissed per user, on this device. */
function storageKey(userId: string): string {
  return `quizV2BannerDismissed:${userId}`;
}

export async function isQuizV2BannerDismissed(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === '1';
  } catch (error) {
    console.warn('Could not read the quiz v2 banner state:', error);
    return false;
  }
}

export async function dismissQuizV2Banner(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), '1');
  } catch (error) {
    console.warn('Could not save the quiz v2 banner state:', error);
  }
}

/** Shown to users whose latest result is from the old quiz, until they retake it or dismiss the banner. */
export function shouldShowQuizV2Banner(latestQuizVersion: number | null, isDismissed: boolean): boolean {
  return latestQuizVersion === 1 && !isDismissed;
}
