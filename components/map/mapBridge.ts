import type { RefObject } from 'react';
import { Platform } from 'react-native';
import type WebView from 'react-native-webview';

type WebViewRef = RefObject<WebView | null>;
type IframeRef = RefObject<HTMLIFrameElement | null>;

export function postToMapView(
  webviewRef: WebViewRef,
  iframeRef: IframeRef,
  message: Record<string, unknown>
): void {
  const payload = JSON.stringify(message);

  if (Platform.OS === 'web') {
    iframeRef.current?.contentWindow?.postMessage(payload, '*');
    return;
  }

  // Android dispatches RN postMessage on document, not window.
  webviewRef.current?.postMessage(payload);
}
