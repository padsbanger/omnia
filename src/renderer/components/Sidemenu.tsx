import { Link } from "react-router-dom";
import { WindowIcon } from "./WindowIcon";
import { IoMdAdd } from "react-icons/io";
import { useEffect } from "react";
import { Button, Drawer, Tooltip } from "@heroui/react";
import { IoTrashBin } from "react-icons/io5";
import { useAppStore } from "../store";
import CreateNewRouteForm from "./CreateNewRouteForm";

const Sidemenu = () => {
  const {
    activeTab,
    unreadCounts,
    setActiveTab,
    updateUnreadCount,
    routes,
    drawerOpen,
    setDrawerOpen,
  } = useAppStore();

  const openDrawer = () => {
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  useEffect(() => {
    if (drawerOpen) return;

    const activeRoute = routes.find((route) => route.id === activeTab);
    if (!activeRoute) return;

    window.electronAPI.invoke("activate-tab", { route: activeRoute });
  }, [drawerOpen, activeTab, routes]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onFromMain(
      "tabId-change",
      (data: { tabId: string }) => {
        setActiveTab(data.tabId);
      },
    );
    return () => unsubscribe?.();
  }, [setActiveTab]);

  useEffect(() => {
    const unsubscribeGlobal = window.electronAPI.onFromMain(
      "global-unread-update",
      ({
        total,
        unreadCounts: newUnreadCounts,
      }: {
        total: number;
        unreadCounts: Array<{ routeId: string; count: number }>;
      }) => {
        newUnreadCounts.forEach(({ routeId, count }) => {
          updateUnreadCount(routeId, count);
        });
        document.title = total > 0 ? `(${total}) Omnia` : "Omnia";
      },
    );

    return () => {
      unsubscribeGlobal?.();
    };
  }, [updateUnreadCount]);

  useEffect(() => {
    return () => setDrawerOpen(false);
  }, [setDrawerOpen]);

  return (
    <div className="w-23.25 h-full bg-gray-800 shadow-lg flex flex-col items-center">
      <Drawer>
        <Tooltip>
          <Button
            isIconOnly
            className="my-6 text-white hover:bg-gray-700"
            onClick={openDrawer}
          >
            <IoMdAdd />
          </Button>
          <Tooltip.Content>
            <p>Add new route.</p>
          </Tooltip.Content>
        </Tooltip>

        {drawerOpen && <CreateNewRouteForm closeDrawer={closeDrawer} />}
      </Drawer>

      {routes.map((route) => {
        const isActive = route.id === activeTab;
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
            {unreadCounts[route.id] > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-sm rounded-full px-1 min-w-5 h-5 flex items-center justify-center">
                {unreadCounts[route.id]}
              </span>
            )}
          </Link>
        );
      })}
      <Tooltip>
        <Button
          isIconOnly
          className={"absolute bottom-6"}
          onClick={() => {
            window.electronAPI.invoke("clear-partitions");
          }}
        >
          <IoTrashBin />
        </Button>
        <Tooltip.Content>
          <p>Clear all routes data.</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
};

export default Sidemenu;
