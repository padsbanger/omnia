import { Link } from "react-router-dom";
import routes from "../routes";
import { WindowIcon } from "./WindowIcon";
import { IoMdAdd } from "react-icons/io";
import { useEffect, useState } from "react";
import { Button, Drawer, Tooltip } from "@heroui/react";
import { IoTrashBin } from "react-icons/io5";

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
        document.title = total > 0 ? `(${total}) Omnia` : "Omnia";
      },
    );

    return () => {
      unsubscribeGlobal?.();
    };
  }, []);

  console.log(unreadMap);

  return (
    <div className="w-23.25 h-full bg-gray-800 shadow-lg flex flex-col items-center">
      <Drawer>
        <Tooltip>
          <Button isIconOnly className="my-6 text-white hover:bg-gray-700">
            <IoMdAdd />
          </Button>
          <Tooltip.Content>
            <p>Add new route.</p>
          </Tooltip.Content>
        </Tooltip>

        <Drawer.Backdrop className={"z-9999"}>
          <Drawer.Content placement="left">
            <Drawer.Dialog>
              <Drawer.Header>
                <Drawer.Heading>Drawer Title</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <p>
                  This is a bottom drawer built with React Aria's Modal
                  component. It slides up from the bottom of the screen with a
                  smooth CSS transition.
                </p>
              </Drawer.Body>
              <Drawer.Footer></Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

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
