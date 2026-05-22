export type RouteMemoryUsage = {
  privateSize: number;
  sharedSize: number;
  residentSet: number;
  heapSizeLimit: number;
  usedHeapSize: number;
};

export type Route = {
  path: string;
  id: string;
  icon: string;
  label: string;
  loadURL: string;
  partition: string;
  internalHosts?: string[];
  openExternalLinksInBrowser?: boolean;
  memoryUsage?: RouteMemoryUsage;
};
