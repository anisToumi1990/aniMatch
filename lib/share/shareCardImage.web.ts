import html2canvas from 'html2canvas';
import { View } from 'react-native';
import { SHARE_CARD_EXPORT_WIDTH } from '@/components/share/ShareCardFrame';
import { ShareCardImageOptions, ShareCardOutcome } from './shareCardTypes';

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png');
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/**
 * Web: renders the card to a 1080px-wide PNG. Uses the Web Share API with the
 * file when the browser can share files, otherwise downloads the PNG.
 */
export async function shareCardImage(view: View, options: ShareCardImageOptions): Promise<ShareCardOutcome> {
  // On web, a react-native-web View ref is the DOM element.
  const element = view as unknown as HTMLElement;
  const canvas = await html2canvas(element, {
    scale: SHARE_CARD_EXPORT_WIDTH / element.offsetWidth,
    backgroundColor: null,
    logging: false,
  });
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], options.fileName, { type: 'image/png' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: options.title, text: `${options.message} ${options.url}` });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
      // e.g. NotAllowedError when the browser decides the tap is too old: save the file instead.
    }
  }

  downloadBlob(blob, options.fileName);
  return 'downloaded';
}
