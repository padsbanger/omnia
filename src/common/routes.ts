export type Route = {
  path: string;
  id: string;
  icon: string;
  label: string;
  loadURL: string;
  partition: string;
  internalHosts?: string[];
  openExternalLinksInBrowser?: boolean;
  memoryUsage?: {
    heapSizeLimit: number;
    usedHeapSize: number;
  };
};
