import { useEffect, useRef } from "react";

declare global {
  interface Window {
    electronAPI: {
      sendToMain: (channel: string, data: any) => void;
      invoke: (channel: string, data: any) => Promise<any>;
      onFromMain: (
        channel: string,
        callback: (...args: any[]) => void,
      ) => (() => void) | undefined;
    };
  }
}

const Component = ({ tabId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.electronAPI.invoke("activate-gmail-tab", { tabId }).then(() => {
      // After activation → sync precise bounds from the <div>
      updateBounds();
    });

    const unsubscribe = window.electronAPI.onFromMain(
      "tab-title-update",
      (data) => {
        if (data.tabId === tabId) {
          console.log("Title updated for this tab:", data.title);
          // Update badge / title in your tab UI here
        }
      },
    );

    window.addEventListener("resize", updateBounds);
    // Optional: ResizeObserver on containerRef for dynamic changes

    updateBounds(); // initial

    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", updateBounds);
      // debouncedUpdate.cancel?.();
    };
  }, [tabId]); // If tabId changes → re-run (switch happened)

  // Helper
  const updateBounds = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    window.electronAPI.invoke("update-gmail-view-bounds", {
      tabId,
      bounds: {
        x: 50,
        y: 0,
        width: Math.round(rect.width),
        height: Math.round(rect.height) - 50,
      },
    });
  };

  // return (
  //   <div
  //     ref={containerRef}
  //     style={{
  //       width: "100%",
  //       height: "100%",
  //       position: "relative",
  //       background: "#f0f0f0", // placeholder while loading
  //       overflow: "hidden",
  //     }}
  //     className="bg-black p-10 text-red-500 h-full"
  //   >
  //     gmail content area
  //   </div>
  // );

  return (
    <webview
      src="https://mail.google.com"
      style={{ width: "100%", height: "100%" }}
      partition={`persist:gmail-${tabId}`}
      useragent="Mozilla/5.0 ..."
    />
  );
};

export default Component;
