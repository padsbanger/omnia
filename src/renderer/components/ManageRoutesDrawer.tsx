import { useMemo, useState } from "react";
import { Button, Description, Label, Tooltip } from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { WindowLayout } from "../../common/drawer";
import { Route } from "../../common/routes";
import { useAppStore } from "../store";
import { IoTrashBin } from "react-icons/io5";
import { IoIosRefresh } from "react-icons/io";
import { RiCloseFill } from "react-icons/ri";
import { WindowIcon } from "./WindowIcon";

type ManageRoutesDrawerProps = {
  closeDrawer: () => void;
  routes?: Array<Route>;
  activeTab?: string | null;
  windowLayout?: WindowLayout;
  onDeleteRoute?: (routeId: string) => Promise<void>;
  onUpdateRouteLabel?: (
    routeId: string,
    label: string,
  ) => Promise<boolean>;
  onToggleHibernation?: (routeId: string) => Promise<void>;
  onWindowLayoutChange?: (windowLayout: WindowLayout) => Promise<void> | void;
  isOffline?: boolean;
};

const ManageRoutesDrawer = ({
  closeDrawer,
  routes: routesProp,
  activeTab: activeTabProp,
  windowLayout: windowLayoutProp,
  onDeleteRoute,
  onUpdateRouteLabel,
  onToggleHibernation,
  onWindowLayoutChange,
  isOffline = false,
}: ManageRoutesDrawerProps) => {
  const navigate = useNavigate();
  const {
    routes: storeRoutes,
    activeTab: storeActiveTab,
    removeRoute,
    setActiveTab,
    updateUnreadCount,
    updateRouteLabel,
    windowLayout: storeWindowLayout,
    setWindowLayout,
    setRouteHibernation,
  } = useAppStore();
  const routes = routesProp ?? storeRoutes;
  const activeTab = activeTabProp ?? storeActiveTab;
  const windowLayout = windowLayoutProp ?? storeWindowLayout;
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);
  const [routeLabelError, setRouteLabelError] = useState<string | null>(null);

  const normalizedEditingLabel = useMemo(
    () => editingLabel.trim(),
    [editingLabel],
  );

  const beginEditingRoute = (route: Route) => {
    if (isOffline) {
      return;
    }

    setEditingRouteId(route.id);
    setEditingLabel(route.label);
    setRouteLabelError(null);
  };

  const cancelEditingRoute = () => {
    setEditingRouteId(null);
    setEditingLabel("");
    setRouteLabelError(null);
  };

  const commitRouteLabel = async (route: Route) => {
    if (!normalizedEditingLabel.length) {
      setRouteLabelError("Route label cannot be empty.");
      return;
    }

    if (normalizedEditingLabel === route.label) {
      cancelEditingRoute();
      return;
    }

    setSavingRouteId(route.id);
    setRouteLabelError(null);

    try {
      if (onUpdateRouteLabel) {
        const wasUpdated = await onUpdateRouteLabel(
          route.id,
          normalizedEditingLabel,
        );
        if (!wasUpdated) {
          setRouteLabelError("Failed to update route label.");
          return;
        }
      } else {
        updateRouteLabel(route.id, normalizedEditingLabel);
      }

      setEditingRouteId(null);
      setEditingLabel("");
    } catch (error) {
      setRouteLabelError(
        error instanceof Error ? error.message : "Failed to update route label.",
      );
    } finally {
      setSavingRouteId(null);
    }
  };

  const handleToggleHibernation = async (routeId: string) => {
    if (onToggleHibernation) {
      await onToggleHibernation(routeId);
      return;
    }

    const route = routes.find((item) => item.id === routeId);
    if (!route) return;

    if (route.isHibernated) {
      const restoredRoute = { ...route, isHibernated: false };
      const result = await window.electronAPI.invoke("create-route-view", {
        route: restoredRoute,
      });

      if (!result?.success) {
        return;
      }

      setRouteHibernation(routeId, false);

      if (activeTab === routeId && windowLayout === "single") {
        void window.electronAPI.invoke("activate-tab", { route: restoredRoute });
      }

      return;
    }

    const result = await window.electronAPI.invoke("hibernate-route-view", {
      route,
    });

    if (!result?.success) {
      return;
    }

    setRouteHibernation(routeId, true);
    updateUnreadCount(routeId, 0);
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (onDeleteRoute) {
      await onDeleteRoute(routeId);
      return;
    }

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

  const formatMegabytes = (kilobytes: number) => `${(kilobytes / 1024).toFixed(1)} MB`;
  const formatGigabytes = (kilobytes: number) => `${(kilobytes / (1024 * 1024)).toFixed(1)} GB`;

  const totalMemoryUsage = routes.reduce((total, route) => {
    if (!route.memoryUsage) {
      return total;
    }
    return total + route.memoryUsage.residentSet;
  }, 0);

  return (
    <div className="flex h-full flex-col bg-white text-slate-950">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Manage routes</h2>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
        {isOffline && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Offline mode: saved routes are available, but adding, renaming, and
            deleting routes requires the Omnia backend.
          </div>
        )}
        {routes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-sm text-slate-500">
            No routes yet.
          </div>
        ) : (
          routes.map((route) => (
            <div
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
              key={route.id}
            >
              <div className="flex flex-row gap-2">
                <WindowIcon icon={route.icon} />
                <div className="flex flex-col">
                  {editingRouteId === route.id ? (
                    <input
                      autoFocus
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      onChange={(event) => setEditingLabel(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          cancelEditingRoute();
                          return;
                        }

                        if (event.key === "Enter") {
                          void commitRouteLabel(route);
                        }
                      }}
                      value={editingLabel}
                    />
                  ) : (
                    <Label className="text-black">{route.label}</Label>
                  )}
                  <Description>{route.loadURL}</Description>
                  <Description>
                    {route.isHibernated
                      ? "Status: hibernated"
                      : route.memoryUsage
                      ? `Memory: ${formatMegabytes(route.memoryUsage.residentSet)}`
                      : "Memory: measuring..."}
                  </Description>
                </div>
              </div>
              {editingRouteId === route.id ? (
                <div className="mt-3 flex flex-row items-center gap-2">
                  <Button
                    className="bg-blue-600 text-white"
                    isDisabled={!normalizedEditingLabel.length}
                    isLoading={savingRouteId === route.id}
                    onClick={() => void commitRouteLabel(route)}
                  >
                    Save
                  </Button>
                  <Button
                    className="border border-slate-200 bg-white text-slate-700"
                    onClick={cancelEditingRoute}
                  >
                    Cancel
                  </Button>
                  {routeLabelError ? (
                    <Description className="text-red-700">
                      {routeLabelError}
                    </Description>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex flex-row items-center justify-start gap-3 align-baseline">
                  <Label>Actions: </Label>
                  <div className="flex flex-row mr-2 gap-2">
                    <Tooltip>
                      <Button
                        className="border border-slate-200 bg-slate-50 text-slate-700"
                        onClick={() => handleToggleHibernation(route.id)}
                      >
                        {route.isHibernated ? "Restore" : "Hibernate"}
                      </Button>
                      <Tooltip.Content>
                        <p>
                          {route.isHibernated
                            ? "Wake this route and recreate its webview."
                            : "Unload this route's webview to free memory."}
                        </p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Button
                        isIconOnly
                        className="border border-slate-200 bg-slate-50 text-slate-700"
                        isDisabled={route.isHibernated}
                        onClick={() => {
                          window.electronAPI.invoke("refresh-view", {
                            route,
                          });
                        }}
                      >
                        <IoIosRefresh />
                      </Button>
                      <Tooltip.Content>
                        <p>Refresh this route.</p>
                      </Tooltip.Content>
                    </Tooltip>

                    <Tooltip>
                      <Button
                        isIconOnly
                        className="border border-slate-200 bg-slate-50 text-slate-700"
                        isDisabled={route.isHibernated}
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
                        className="border border-slate-200 bg-slate-50 text-slate-700"
                        isDisabled={isOffline}
                        onClick={() => beginEditingRoute(route)}
                      >
                        Rename
                      </Button>
                      <Tooltip.Content>
                        <p>Rename this route label.</p>
                      </Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Button
                        isIconOnly
                        className="border border-slate-200 bg-slate-50 text-slate-700"
                        isDisabled={isOffline}
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
              )}
            </div>
          ))
        )}
        {routes.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col">
              <Label>Window layout</Label>
              <Description>
                Spread all routes evenly in a single window.
              </Description>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                className={
                  windowLayout === "spread"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }
                onClick={() => {
                  const nextLayout =
                    windowLayout === "spread" ? "single" : "spread";
                  if (onWindowLayoutChange) {
                    void onWindowLayoutChange(nextLayout);
                    return;
                  }

                  setWindowLayout(nextLayout);
                }}
              >
                Columns
              </Button>
              <Button
                type="button"
                className={
                  windowLayout === "matrix"
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700"
                }
                onClick={() => {
                  const nextLayout =
                    windowLayout === "matrix" ? "single" : "matrix";
                  if (onWindowLayoutChange) {
                    void onWindowLayoutChange(nextLayout);
                    return;
                  }

                  setWindowLayout(nextLayout);
                }}
              >
                Matrix
              </Button>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col">
            <Label className="text-black">Total memory usage: {formatGigabytes(totalMemoryUsage)}</Label>
          </div>
        </div>
        <div className="mt-auto flex justify-end">
          <Button
            type="button"
            className="border border-slate-200 bg-white text-slate-700"
            onClick={closeDrawer}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ManageRoutesDrawer;
