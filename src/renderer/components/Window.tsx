import { useEffect, useRef } from "react";
import { Route } from "../../common/routes";
import { useAppStore } from "../store";

const SIDEMENU_WIDTH = 93;
const DRAWER_WIDTH = 360;

type WindowProps = {
  route: Route;
};

const Window = ({ route }: WindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeDrawer } = useAppStore();
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
        x: SIDEMENU_WIDTH + (activeDrawer ? DRAWER_WIDTH : 0),
        y: 0,
        width: Math.max(
          200,
          Math.round(rect.width) - (activeDrawer ? DRAWER_WIDTH : 0),
        ),
        height: Math.round(rect.height),
      },
    });
  };

  useEffect(() => {
    updateBounds();
  }, [route.id, activeDrawer]);

  const handleRefresh = (route: Route) => {
    window.electronAPI.invoke("refresh-view", { route });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "r") {
        event.preventDefault();
        handleRefresh(route);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [route]);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          left: SIDEMENU_WIDTH,
          top: 0,
          width: `calc(100% - ${SIDEMENU_WIDTH}px)`,
          height: "calc(100%)",
          background: "#f0f0f0", // placeholder while loading
          overflow: "hidden",
          zIndex: 1,
        }}
      ></div>
    </>
  );
};

export default Window;
