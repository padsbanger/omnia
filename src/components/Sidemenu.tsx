import { Link } from "react-router-dom";
import routes from "../routes";
import { WindowIcon } from "./WindowIcon";
import { useEffect, useState } from "react";


const Sidemenu = () => {
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = window.electronAPI.onFromMain(
      "tabId-change",
      (data: { tabId: string }) => {
        setActiveTabId(data.tabId);
      },
    );
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const unsubscribeGlobal = window.electronAPI.onFromMain(
      "global-unread-update",
      ({
        total,
        unreadCounts,
      }: {
        total: number;
        unreadCounts: Array<{ routeId: string; count: number }>;
      }) => {
        const newMap: Record<string, number> = {};
        unreadCounts.forEach(({ routeId, count }) => {
          newMap[routeId] = count;
        });
        setUnreadMap(newMap);
        document.title = total > 0 ? `(${total}) My App` : "My App";
        // Or use Electron app.setBadgeCount(total);  // shows red badge on taskbar icon (Windows/macOS)
      },
    );

    return () => {
      unsubscribeGlobal?.();
    };
  }, []);

  console.log(unreadMap);

  return (
    <div className="w-[93px] h-full bg-gray-800 shadow-lg flex flex-col items-center">
      {routes.map((route) => {
        const isActive = route.id === activeTabId;
        return (
          <Link
            to={route.path}
            key={route.id}
            className={`w-full text-center py-3 px-2 flex flex-col gap-2 align-middle text-sm font-medium transition-colors duration-200 mx-2 last:mb-0 relative ${
              isActive
                ? "bg-blue-500 text-white shadow-inner"
                : "text-white hover:bg-gray-700"
            }`}
          >
            <WindowIcon className="m-auto" icon={route.icon} />
            {route.label}
            {unreadMap[route.id] > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-sm rounded-full px-1 min-w-[18px] h-4 flex items-center justify-center">
                {unreadMap[route.id]}
              </span>
            )}
          </Link>
        );
      })}
      <button
        className="w-full text-center py-3 px-2 text-white text-sm font-medium bg-blue-600 hover:bg-blue-700 transition-colors duration-200 rounded-md mx-2 mt-auto"
        onClick={() => console.log("Add new link")}
      >
        +
      </button>
    </div>
  );
};

export default Sidemenu;
