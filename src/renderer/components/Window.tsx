import { useEffect, useRef } from "react";
import { Route } from "../../common/routes";

const SIDEMENU_WIDTH = 100;

type WindowProps = {
  route: Route;
};

const Window = ({ route }: WindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (route.isHibernated) {
      return;
    }

    window.electronAPI.invoke("activate-tab", { route }).then(() => {
      updateBounds();
    });

    const unsubscribe = window.electronAPI.onFromMain(
      "tab-title-update",
      (data: { tabId: string; title: string }) => {
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
  }, [route.id, route.isHibernated]);

  // Helper
  const updateBounds = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();

    window.electronAPI.invoke("update-view-bounds", {
      route,
      bounds: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.max(200, Math.round(rect.width)),
        height: Math.round(rect.height),
      },
    });
  };

  useEffect(() => {
    if (route.isHibernated) {
      return;
    }

    updateBounds();
  }, [route.id, route.isHibernated]);

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
      >
        {route.isHibernated && (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
            This route is hibernated. Restore it from Manage routes.
          </div>
        )}
      </div>
    </>
  );
};

export default Window;
