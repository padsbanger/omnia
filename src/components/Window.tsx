import { useEffect, useRef } from "react";
import { Route } from "src/routes";

type WindowProps = {
  route: Route;
};

const Window = ({ route }: WindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.electronAPI.invoke("activate-tab", { route }).then(() => {
      updateBounds();
    });

    const unsubscribe = window.electronAPI.onFromMain(
      "tab-title-update",
      (data) => {
        if (data.tabId === route.id) {
          console.log("Title updated for this tab:", data.title);
        }
      },
    );

    const resizeObserver = new ResizeObserver(() => {
      updateBounds();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    updateBounds(); // initial

    return () => {
      unsubscribe?.();
      resizeObserver.disconnect();
    };
  }, [route.id]);

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
        position: "absolute",
        left: 93,
        top: 50,
        width: "calc(100% - 93px)",
        height: "calc(100% - 50px)",
        background: "#f0f0f0", // placeholder while loading
        overflow: "hidden",
      }}
      className="bg-black p-10 text-red-500"
    >
      content area
    </div>
  );
};

export default Window;
