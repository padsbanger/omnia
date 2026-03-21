import { useEffect, useRef } from "react";
import { Route } from "src/routes";

type WindowProps = {
  route: Route;
};

const Window = ({ route }: WindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.electronAPI.invoke("activate-tab", { route }).then(() => {
      // After activation → sync precise bounds from the <div>
      updateBounds();
    });

    const unsubscribe = window.electronAPI.onFromMain(
      "tab-title-update",
      (data) => {
        if (data.tabId === route.id) {
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
  }, [route.id]); // If tabId changes → re-run (switch happened)

  // Helper
  const updateBounds = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    window.electronAPI.invoke("update-view-bounds", {
      route,
      bounds: {
        x: 93,
        y: 50,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#f0f0f0", // placeholder while loading
        overflow: "hidden",
      }}
      className="bg-black p-10 text-red-500 h-full"
    >
      gmail content area
    </div>
  );
};

export default Window;
