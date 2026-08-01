import { ApiRoute } from "../../common/routeMapping";

type CreateRouteBody = {
  name: string;
  url: string;
  icon?: string;
  order?: number;
  metadata?: Record<string, unknown>;
};

type UpdateRouteBody = {
  name?: string;
  order?: number;
};

export const listRoutes = (token: string) =>
  window.electronAPI.invoke("routes-list", { token }) as Promise<{
    routes: ApiRoute[];
  }>;

export const createRoute = (token: string, route: CreateRouteBody) =>
  window.electronAPI.invoke("routes-create", {
    token,
    route,
  }) as Promise<{ route: ApiRoute }>;

export const deleteRoute = (token: string, routeId: string) =>
  window.electronAPI.invoke("routes-delete", {
    token,
    routeId,
  }) as Promise<{ success: boolean }>;

export const updateRoute = (
  token: string,
  routeId: string,
  route: UpdateRouteBody,
) =>
  window.electronAPI.invoke("routes-update", {
    token,
    routeId,
    route,
  }) as Promise<{ route: ApiRoute }>;
