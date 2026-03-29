import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../store";

const DRAWER_WIDTH = 360;

type ContainerMap = Map<string, HTMLDivElement>;

const SpreadWindows = () => {
  const { routes, activeDrawer, windowLayout } = useAppStore();
  const containerRefs = useRef<ContainerMap>(new Map());
  const rootRef = useRef<HTMLDivElement>(null);

  const gridStyle = useMemo(() => {
    const panes = Math.max(routes.length, 1);

    if (windowLayout === "matrix") {
      const cols = Math.ceil(Math.sqrt(panes));
      const rows = Math.ceil(panes / cols);
      return {
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      };
    }

    return {
      gridTemplateColumns: `repeat(${panes}, minmax(0, 1fr))`,
    };
  }, [routes.length, windowLayout]);

  const updateRouteBounds = useCallback(
    (routeId: string) => {
      const route = routes.find((item) => item.id === routeId);
      const container = containerRefs.current.get(routeId);

      if (!route || !container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const drawerOffset = activeDrawer ? DRAWER_WIDTH : 0;

      window.electronAPI.invoke("update-view-bounds", {
        route,
        bounds: {
          x: Math.round(rect.left) + drawerOffset,
          y: Math.round(rect.top),
          width: Math.max(200, Math.round(rect.width) - drawerOffset),
          height: Math.round(rect.height),
        },
      });
    },
    [activeDrawer, routes],
  );

  const syncAllBounds = useCallback(() => {
    routes.forEach((route) => {
      updateRouteBounds(route.id);
    });
  }, [routes, updateRouteBounds]);

  useEffect(() => {
    routes.forEach((route) => {
      window.electronAPI.invoke("create-route-view", { route });
    });
  }, [routes]);

  useEffect(() => {
    let frameId: number | null = null;

    const scheduleSync = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        syncAllBounds();
        frameId = null;
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      scheduleSync();
    });

    if (rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }

    routes.forEach((route) => {
      const container = containerRefs.current.get(route.id);
      if (container) {
        resizeObserver.observe(container);
      }
    });

    const unsubscribeMainResize = window.electronAPI.onFromMain(
      "main-window-resize",
      () => {
        scheduleSync();
      },
    );

    window.addEventListener("resize", scheduleSync);
    scheduleSync();

    return () => {
      unsubscribeMainResize?.();
      window.removeEventListener("resize", scheduleSync);
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [routes, syncAllBounds]);

  return (
    <div ref={rootRef} className="h-full w-full grid" style={gridStyle}>
      {routes.map((route, index) => (
        <div
          key={route.id}
          ref={(node) => {
            if (!node) {
              containerRefs.current.delete(route.id);
              return;
            }

            containerRefs.current.set(route.id, node);
          }}
          className={
            index > 0
              ? "h-full w-full border-l border-gray-700"
              : "h-full w-full"
          }
        />
      ))}
    </div>
  );
};

export default SpreadWindows;
