import { useMemo, useState } from 'react';
import { Button, Label } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { WindowLayout } from '../../common/drawer';
import { Route } from '../../common/routes';
import { useAppStore } from '../store';
import ManageRouteCard from './ManageRouteCard';
import RouteLayoutControls from './RouteLayoutControls';

type ManageRoutesDrawerProps = {
  closeDrawer: () => void;
  routes?: Array<Route>;
  activeTab?: string | null;
  windowLayout?: WindowLayout;
  onDeleteRoute?: (routeId: string) => Promise<void>;
  onUpdateRouteLabel?: (routeId: string, label: string) => Promise<boolean>;
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
  const [editingLabel, setEditingLabel] = useState('');
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);
  const [routeLabelError, setRouteLabelError] = useState<string | null>(null);
  const [routeZoomLevels, setRouteZoomLevels] = useState<
    Record<string, number>
  >({});

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
    setEditingLabel('');
    setRouteLabelError(null);
  };

  const commitRouteLabel = async (route: Route) => {
    if (!normalizedEditingLabel.length) {
      setRouteLabelError('Route label cannot be empty.');
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
          setRouteLabelError('Failed to update route label.');
          return;
        }
      } else {
        updateRouteLabel(route.id, normalizedEditingLabel);
      }

      setEditingRouteId(null);
      setEditingLabel('');
    } catch (error) {
      setRouteLabelError(
        error instanceof Error
          ? error.message
          : 'Failed to update route label.',
      );
    } finally {
      setSavingRouteId(null);
    }
  };

  const restoreRoute = async (route: Route) => {
    const restoredRoute = { ...route, isHibernated: false };
    const result = await window.electronAPI.invoke('create-route-view', {
      route: restoredRoute,
    });
    if (!result?.success) return;

    setRouteHibernation(route.id, false);
    if (activeTab === route.id && windowLayout === 'single') {
      void window.electronAPI.invoke('activate-tab', { route: restoredRoute });
    }
  };

  const hibernateRoute = async (route: Route) => {
    const result = await window.electronAPI.invoke('hibernate-route-view', {
      route,
    });
    if (!result?.success) return;

    setRouteHibernation(route.id, true);
    updateUnreadCount(route.id, 0);
  };

  const handleToggleHibernation = async (routeId: string) => {
    if (onToggleHibernation) {
      await onToggleHibernation(routeId);
      return;
    }

    const route = routes.find((item) => item.id === routeId);
    if (!route) return;

    await (route.isHibernated ? restoreRoute(route) : hibernateRoute(route));
  };

  const activateFallbackRoute = (fallbackRoute: Route | null) => {
    if (fallbackRoute) {
      setActiveTab(fallbackRoute.id);
      navigate(fallbackRoute.path);
      void window.electronAPI.invoke('activate-tab', { route: fallbackRoute });
      return;
    }

    setActiveTab(null);
    navigate('/');
  };

  const handleDeleteRoute = async (routeId: string) => {
    if (onDeleteRoute) {
      await onDeleteRoute(routeId);
      return;
    }

    const route = routes.find((item) => item.id === routeId);
    if (!route) return;

    const result = await window.electronAPI.invoke('delete-route-view', {
      route,
    });

    if (!result?.success) {
      return;
    }

    const fallbackRoute = routes.find((item) => item.id !== routeId) ?? null;

    removeRoute(routeId);
    if (activeTab === routeId) activateFallbackRoute(fallbackRoute);
  };

  const handleWindowLayoutChange = (nextLayout: WindowLayout) => {
    if (onWindowLayoutChange) {
      void onWindowLayoutChange(nextLayout);
      return;
    }

    setWindowLayout(nextLayout);
  };

  const handleRouteZoom = async (route: Route, direction: 'in' | 'out') => {
    const result = await window.electronAPI.invoke<{
      success: boolean;
      zoomLevel?: number;
    }>('change-route-zoom', { route, direction });

    const zoomLevel = result.zoomLevel;
    if (typeof zoomLevel !== 'number') return;
    setRouteZoomLevels((currentLevels) => ({
      ...currentLevels,
      [route.id]: zoomLevel,
    }));
  };

  const formatGigabytes = (kilobytes: number) =>
    `${(kilobytes / (1024 * 1024)).toFixed(1)} GB`;

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
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
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
            <ManageRouteCard
              editingLabel={editingLabel}
              isEditing={editingRouteId === route.id}
              isOffline={isOffline}
              isSaving={savingRouteId === route.id}
              key={route.id}
              labelError={routeLabelError}
              onBeginEditing={beginEditingRoute}
              onCancelEditing={cancelEditingRoute}
              onChangeLabel={setEditingLabel}
              onCommitLabel={(item) => void commitRouteLabel(item)}
              onDelete={(routeId) => void handleDeleteRoute(routeId)}
              onToggleHibernation={(routeId) =>
                void handleToggleHibernation(routeId)
              }
              onZoomRoute={(route, direction) =>
                void handleRouteZoom(route, direction)
              }
              route={route}
              zoomLevel={routeZoomLevels[route.id] ?? route.zoomLevel ?? 0}
            />
          ))
        )}
        {routes.length > 0 && (
          <RouteLayoutControls
            onWindowLayoutChange={handleWindowLayoutChange}
            windowLayout={windowLayout}
          />
        )}
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col">
            <Label className="text-black">
              Total memory usage: {formatGigabytes(totalMemoryUsage)}
            </Label>
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
