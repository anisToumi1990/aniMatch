import { Share, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { ShareCardImageOptions, ShareCardOutcome } from './shareCardTypes';

/**
 * Native (iOS): captures the card as a PNG and opens the share sheet with the
 * image, the message and the app link.
 */
export async function shareCardImage(view: View, options: ShareCardImageOptions): Promise<ShareCardOutcome> {
  const uri = await captureRef(view, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
    fileName: options.fileName.replace(/\.png$/, ''),
  });
  const result = await Share.share(
    { url: uri, message: `${options.message} ${options.url}`, title: options.title },
    { subject: options.title },
  );
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}
