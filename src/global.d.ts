declare interface Window {
  ZJSBridge?: any;
  APP_ID?: string;
  BASE_PATH?: string;
  APP_CONFIG: any;
}

// requestIdleCallback may not exist in all Zalo webview runtimes
declare function requestIdleCallback(
  callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
  options?: { timeout: number }
): number;
