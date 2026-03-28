import { Link } from "react-router-dom";
import { WindowIcon } from "./WindowIcon";
import { IoMdAdd } from "react-icons/io";
import { useEffect, useState, type DragEvent } from "react";
import { Button, Drawer, Tooltip } from "@heroui/react";
import { FaEdit } from "react-icons/fa";
import { useAppStore } from "../store";
import CreateNewRouteForm from "./CreateNewRouteForm";
import ManageRoutesDrawer from "./ManageRoutesDrawer";

const Sidemenu = () => {
  const {
    activeTab,
    unreadCounts,
    setActiveTab,
    updateUnreadCount,
    routes,
    activeDrawer,
    setActiveDrawer,
    updateRoutesOrder,
  } = useAppStore();
  const [draggedRouteId, setDraggedRouteId] = useState<string | null>(null);
  const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);

  const closeDrawer = () => {
    setActiveDrawer(null);
  };

  const handleDragStart = (routeId: string) => {
    setDraggedRouteId(routeId);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    routeId: string,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (!draggedRouteId || draggedRouteId === routeId) {
      setDragOverRouteId(null);
      return;
    }

    setDragOverRouteId(routeId);
  };

  const handleDrop = (targetRouteId: string) => {
    if (!draggedRouteId || draggedRouteId === targetRouteId) return;

    const fromIndex = routes.findIndex((route) => route.id === draggedRouteId);
    const toIndex = routes.findIndex((route) => route.id === targetRouteId);

    if (fromIndex < 0 || toIndex < 0) return;

    const nextRoutes = [...routes];
    const [movedRoute] = nextRoutes.splice(fromIndex, 1);
    nextRoutes.splice(toIndex, 0, movedRoute);

    updateRoutesOrder(nextRoutes);
    setDraggedRouteId(null);
    setDragOverRouteId(null);
  };

  const handleDragEnd = () => {
    setDraggedRouteId(null);
    setDragOverRouteId(null);
  };

  useEffect(() => {
    if (activeDrawer) return;

    const activeRoute = routes.find((route) => route.id === activeTab);
    if (!activeRoute) return;

    window.electronAPI.invoke("activate-tab", { route: activeRoute });
  }, [activeDrawer, activeTab, routes]);

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
    return () => setActiveDrawer(null);
  }, [setActiveDrawer]);

  const activeDrawerContent =
    activeDrawer === "create" ? (
      <CreateNewRouteForm key="create" closeDrawer={closeDrawer} />
    ) : activeDrawer === "manage" ? (
      <ManageRoutesDrawer key="manage" closeDrawer={closeDrawer} />
    ) : null;

  return (
    <div className="w-23.25 h-full bg-gray-800 shadow-lg flex flex-col items-center">
      <Drawer
        isOpen={activeDrawer !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeDrawer();
          }
        }}
      >
        <Tooltip>
          <Button
            isIconOnly
            className="my-6 text-white hover:bg-gray-700"
            onClick={() => {
              setActiveDrawer("create");
            }}
          >
            <IoMdAdd />
          </Button>
          <Tooltip.Content>
            <p>Add new route.</p>
          </Tooltip.Content>
        </Tooltip>

        {activeDrawerContent}
      </Drawer>
      {routes.map((route) => {
        const isActive = route.id === activeTab;
        return (
          <div
            key={route.id}
            draggable
            onDragStart={() => handleDragStart(route.id)}
            onDragOver={(event) => handleDragOver(event, route.id)}
            onDrop={() => handleDrop(route.id)}
            onDragEnd={handleDragEnd}
            className="w-full"
          >
            {dragOverRouteId === route.id && draggedRouteId !== route.id && (
              <div className="mx-2 my-1 h-9 rounded-md border-2 border-dashed border-blue-400 bg-blue-500/15" />
            )}
            <Link
              to={route.path}
              className={`w-full text-center py-3 px-2  flex flex-col gap-2 align-middle text-sm font-medium transition-colors duration-200 last:mb-0 relative cursor-move ${
                isActive
                  ? "bg-blue-500 text-white shadow-inner"
                  : "text-white hover:bg-gray-700"
              } ${draggedRouteId === route.id ? "opacity-60" : "opacity-100"}`}
            >
              <WindowIcon className="m-auto" icon={route.icon} />
              {route.label}
              {unreadCounts[route.id] > 0 && (
                <span
                  key={unreadCounts[route.id]} // Key ensures re-animation on count change
                  className="absolute top-1 right-1
                    bg-red-500 text-white text-sm rounded-full px-1 min-w-5 h-5 flex items-center justify-center
                    animate-[fadeIn_0.3s_ease-out]
                  "
                >
                  {unreadCounts[route.id]}
                </span>
              )}
            </Link>
          </div>
        );
      })}
      {routes.length > 0 && (
        <Tooltip>
          <Button
            isIconOnly
            className={"absolute bottom-6"}
            onClick={() => {
              setActiveDrawer("manage");
            }}
          >
            <FaEdit />
          </Button>
          <Tooltip.Content>
            <p>Edit routes.</p>
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );
};

export default Sidemenu;
