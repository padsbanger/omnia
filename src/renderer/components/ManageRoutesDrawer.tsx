import { type ReactNode } from "react";
import { Button, Description, Drawer, Label, Tooltip } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { IoTrashBin } from "react-icons/io5";
import { IoIosRefresh } from "react-icons/io";
import { RiCloseFill } from "react-icons/ri";

type ManageRoutesDrawerProps = {
  closeDrawer: () => void;
};

const ManageRoutesDrawer = ({ closeDrawer }: ManageRoutesDrawerProps) => {
  const navigate = useNavigate();
  const { routes, activeTab, removeRoute, setActiveTab } = useAppStore();

  const handleDeleteRoute = async (routeId: string) => {
    const route = routes.find((item) => item.id === routeId);
    if (!route) return;

    const result = await window.electronAPI.invoke("delete-route-view", {
      route,
    });

    if (!result?.success) {
      return;
    }

    const fallbackRoute = routes.find((item) => item.id !== routeId) ?? null;

    removeRoute(routeId);

    if (activeTab !== routeId) {
      return;
    }

    if (fallbackRoute) {
      setActiveTab(fallbackRoute.id);
      navigate(fallbackRoute.path);
      void window.electronAPI.invoke("activate-tab", { route: fallbackRoute });
      return;
    }

    setActiveTab(null);
    navigate("/");
  };

  return (
    <Drawer.Backdrop
      variant="transparent"
      isDismissable={false}
      className="z-2000"
      onClick={closeDrawer}
    >
      <Drawer.Content placement="left" className="z-2001 w-90 ml-23.25">
        <div onClick={(event) => event.stopPropagation()}>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Manage routes</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col gap-3 p-2">
                {routes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                    No routes yet.
                  </div>
                ) : (
                  routes.map((route) => (
                    <div className="flex flex-row">
                      <div className="flex flex-col">
                        <Label>{route.label}</Label>
                        <Description>{route.loadURL}</Description>
                      </div>
                      <div className="flex flex-row ml-auto mr-2 gap-1">
                        <Button
                          isIconOnly
                          variant="secondary"
                          onClick={() => {
                            window.electronAPI.invoke("refresh-view", {
                              route,
                            });
                          }}
                        >
                          <IoIosRefresh />
                        </Button>
                        <Tooltip>
                          <Button
                            isIconOnly
                            variant="secondary"
                            onClick={() => {
                              window.electronAPI.invoke(
                                "clear-single-partition",
                                { route },
                              );
                            }}
                          >
                            <IoTrashBin />
                          </Button>
                          <Tooltip.Content>
                            <p>Clear site data for this route.</p>
                          </Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                          <Button
                            isIconOnly
                            variant="secondary"
                            onClick={() => handleDeleteRoute(route.id)}
                          >
                            <RiCloseFill />
                          </Button>
                          <Tooltip.Content>
                            <p>Delete this route.</p>
                          </Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  ))
                )}
                <div className="mt-2 flex justify-end">
                  <Button type="button" onClick={closeDrawer}>
                    Close
                  </Button>
                </div>
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </div>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};

export default ManageRoutesDrawer;
