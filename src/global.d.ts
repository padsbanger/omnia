declare global {
  interface Window {
    electronAPI: {
      sendToMain: (channel: string, data: any) => void;
      invoke: (channel: string, data?: any) => Promise<any>;
      onFromMain: (
        channel: string,
        callback: (...args: any[]) => void,
      ) => (() => void) | undefined;
    };
  }
}

export {};
