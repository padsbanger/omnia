import { useEffect, useRef } from "react";
import { Route } from "../../common/routes";

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
        y: 0,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  };

  const handleRefresh = () => {
    window.electronAPI.invoke("refresh-view", { route });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "r") {
        event.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest(
        "a",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        console.log("Opening external link:", href);
        event.preventDefault();
        window.electronAPI.invoke("open-external-link", { url: href });
      } else {
        console.log("Internal link clicked:", href);
      }
    };

    const container = containerRef.current;
    if (container) container.addEventListener("click", handleClick, true); // capture phase

    return () => container?.removeEventListener("click", handleClick, true);
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          left: 93,
          top: 0,
          width: "calc(100% - 93px)",
          height: "calc(100%)",
          background: "#f0f0f0", // placeholder while loading
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        content area
      </div>
    </>
  );
};

export default Window;
