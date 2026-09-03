import { Link } from 'react-router-dom';
import { WindowIcon } from './WindowIcon';
import { useEffect, useState, type DragEvent } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { MdAdd, MdLogout, MdOutlineBedtime, MdTune } from 'react-icons/md';
import { useAppStore, useAuthStore } from '../store';
import { updateRoute } from '../api/routes';
import WorkspaceLayoutSwitcher from './WorkspaceLayoutSwitcher';

type UnreadState = {
  total: number;
  unreadCounts: Array<{ routeId: string; count: number }>;
  revision: number;
};

const Sidemenu = () => {
  const {
    activeTab,
    isOffline,
    unreadCounts,
    setActiveTab,
    replaceUnreadCounts,
    updateRouteMemoryUsage,
    routes,
    windowLayout,
    setWindowLayout,
    setActiveDrawer,
    clearRoutes,
    updateRoutesOrder,
  } = useAppStore();
  const { clearSession, user, token } = useAuthStore();
  const [draggedRouteId, setDraggedRouteId] = useState<string | null>(null);
  const [dragOverRouteId, setDragOverRouteId] = useState<string | null>(null);

  const handleDragStart = (routeId: string) => {
    setDraggedRouteId(routeId);
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    routeId: string,
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    if (!draggedRouteId || draggedRouteId === routeId) {
      setDragOverRouteId(null);
      return;
    }

    setDragOverRouteId(routeId);
  };

  const persistRouteOrder = async (
    nextRoutes: Array<(typeof routes)[number]>,
  ) => {
    if (!token || isOffline) {
      return;
    }

    try {
      await Promise.all(
        nextRoutes.map((route, order) =>
          updateRoute(token, route.id, { order }),
        ),
      );
    } catch (error) {
      console.error('Failed to persist route order', error);
    }
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
    void persistRouteOrder(nextRoutes);
    setDraggedRouteId(null);
    setDragOverRouteId(null);
  };

  const handleDragEnd = () => {
    setDraggedRouteId(null);
    setDragOverRouteId(null);
  };

  const handleLogout = async () => {
    await window.electronAPI.invoke('clear-route-views').catch((error) => {
      console.error('Failed to clear route views on logout', error);
    });
    clearRoutes();
    clearSession();
    document.title = 'Omnia';
  };

  useEffect(() => {
    if (windowLayout !== 'single') return;

    const activeRoute = routes.find((route) => route.id === activeTab);
    if (!activeRoute || activeRoute.isHibernated) return;

    window.electronAPI.invoke('activate-tab', { route: activeRoute });
  }, [activeTab, windowLayout]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onFromMain(
      'tabId-change',
      (data: { tabId: string | null }) => {
        setActiveTab(data.tabId);
      },
    );
    return () => unsubscribe?.();
  }, [setActiveTab]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onFromMain('open-settings', () => {
      setActiveDrawer('settings');
    });

    return () => unsubscribe?.();
  }, [setActiveDrawer]);

  useEffect(() => {
    let isDisposed = false;
    let latestRevision = -1;

    const applyUnreadState = ({
      total,
      unreadCounts: newUnreadCounts,
      revision,
    }: UnreadState) => {
      if (isDisposed || revision < latestRevision) {
        return;
      }

      latestRevision = revision;
      replaceUnreadCounts(
        Object.fromEntries(
          newUnreadCounts.map(({ routeId, count }) => [routeId, count]),
        ),
      );
      document.title = total > 0 ? `(${total}) Omnia` : 'Omnia';
    };

    const unsubscribeGlobal = window.electronAPI.onFromMain(
      'global-unread-update',
      applyUnreadState,
    );

    void window.electronAPI
      .invoke<UnreadState>('get-unread-state')
      .then(applyUnreadState)
      .catch((error) => {
        console.error('Failed to load unread state', error);
      });

    return () => {
      isDisposed = true;
      unsubscribeGlobal?.();
    };
  }, [replaceUnreadCounts]);

  useEffect(() => {
    const unsubscribeMemory = window.electronAPI.onFromMain(
      'route-memory-usage-updated',
      ({
        routeId,
        memoryUsage,
      }: {
        routeId: string;
        memoryUsage?: {
          privateSize: number;
          sharedSize: number;
          residentSet: number;
          heapSizeLimit: number;
          usedHeapSize: number;
        };
      }) => {
        updateRouteMemoryUsage(routeId, memoryUsage);
      },
    );

    return () => {
      unsubscribeMemory?.();
    };
  }, [updateRouteMemoryUsage]);

  useEffect(() => {
    return () => setActiveDrawer(null);
  }, [setActiveDrawer]);

  return (
    <aside className="relative z-20 flex h-full w-[100px] shrink-0 flex-col items-center border-r border-white/5 bg-[#080c17] shadow-[8px_0_30px_rgba(2,6,23,0.18)]">
      <div className="flex w-full shrink-0 items-center justify-center border-b border-white/[0.06] p-3">
        <Tooltip>
          <Button
            aria-label="Add route"
            className="h-11 min-h-11 w-11 min-w-11 rounded-xl bg-blue-500 px-0 text-white shadow-lg shadow-blue-950/30 hover:bg-blue-400 my-2 "
            isDisabled={isOffline}
            onClick={() => {
              setActiveDrawer('create');
            }}
          >
            <MdAdd className="text-[30px]" />
          </Button>
          <Tooltip.Content>
            <p>
              {isOffline
                ? 'Reconnect to the Omnia backend to add routes.'
                : 'Add new route.'}
            </p>
          </Tooltip.Content>
        </Tooltip>
      </div>
      {isOffline && (
        <Tooltip>
          <button
            type="button"
            className="mt-3 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300"
            onClick={() => window.location.reload()}
          >
            Offline
          </button>
          <Tooltip.Content>
            <p>Using saved routes. Click to retry the backend connection.</p>
          </Tooltip.Content>
        </Tooltip>
      )}
      <nav className="omnia-scrollbar flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
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
                <div className="mx-1 my-1 h-10 rounded-xl border border-dashed border-blue-400/70 bg-blue-400/10" />
              )}
              <Link
                to={route.path}
                className={`group relative flex w-full cursor-grab flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-all duration-200 active:cursor-grabbing ${
                  isActive
                    ? 'bg-white/[0.11] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.16)]'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                } ${draggedRouteId === route.id ? 'scale-95 opacity-50' : 'opacity-100'}`}
              >
                {isActive && (
                  <span className="absolute -left-2 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.65)]" />
                )}
                <div className="relative flex h-10 items-center justify-center">
                  <WindowIcon
                    className="text-[30px]"
                    faviconUrl={route.faviconUrl}
                    icon={route.icon}
                  />
                  {route.isHibernated ? (
                    <span className="absolute -bottom-1 -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] text-slate-950 ring-2 ring-[#080c17]">
                      <MdOutlineBedtime />
                    </span>
                  ) : null}
                  {unreadCounts[route.id] > 0 && (
                    <span
                      key={unreadCounts[route.id]}
                      className="absolute -right-3 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-[#080c17] animate-[fadeIn_0.3s_ease-out]"
                    >
                      {unreadCounts[route.id]}
                    </span>
                  )}
                </div>
                <span className="w-full truncate text-xs font-semibold leading-tight">
                  {route.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>
      <WorkspaceLayoutSwitcher
        onWindowLayoutChange={setWindowLayout}
        routeCount={routes.length}
        windowLayout={windowLayout}
      />
      <div className="flex w-full shrink-0 items-center justify-between border-t border-white/[0.06] p-3">
        {routes.length > 0 ? (
          <Tooltip>
            <Button
              aria-label="Manage routes"
              isIconOnly
              className="h-9 min-h-9 w-9 min-w-9 rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-300 hover:bg-white/[0.1] hover:text-white"
              onClick={() => {
                setActiveDrawer('manage');
              }}
            >
              <MdTune className="text-lg" />
            </Button>
            <Tooltip.Content>
              <p>Manage routes.</p>
            </Tooltip.Content>
          </Tooltip>
        ) : (
          <span className="h-9 w-9" />
        )}
        <Tooltip>
          <Button
            aria-label="Sign out"
            isIconOnly
            className="h-9 min-h-9 w-9 min-w-9 rounded-xl border border-white/[0.08] bg-white/[0.05] text-slate-300 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={handleLogout}
          >
            <MdLogout className="text-lg" />
          </Button>
          <Tooltip.Content>
            <p>{user?.email ? `Sign out ${user.email}` : 'Sign out'}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </aside>
  );
};

export default Sidemenu;
