type DefaultIpcResult = {
  success?: boolean;
  [key: string]: unknown;
};

declare global {
  interface Window {
    electronAPI: {
      sendToMain: (channel: string, data: unknown) => void;
      invoke: <Result extends object = DefaultIpcResult>(
        channel: string,
        data?: unknown,
      ) => Promise<Result>;
      onFromMain: <Args extends unknown[]>(
        channel: string,
        callback: (...args: Args) => void,
      ) => (() => void) | undefined;
    };
  }
}

export {};
