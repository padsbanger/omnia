import { ApiRoute } from "../common/routeMapping";

const API_BASE_URL = "https://omnia-backend-production.up.railway.app";

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

type CreateRouteBody = {
  name: string;
  url: string;
  icon?: string;
  order?: number;
  metadata?: Record<string, unknown>;
};

const getErrorMessage = async (response: Response) => {
  let payload: ApiErrorResponse | null = null;

  try {
    payload = (await response.json()) as ApiErrorResponse;
  } catch {
    payload = null;
  }

  return (
    payload?.message ??
    payload?.error ??
    `Request failed with status ${response.status}`
  );
};

const requestJson = async <T>(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const listRoutes = (token: string) =>
  requestJson<{ routes: ApiRoute[] }>("/routes", token);

export const createRoute = (token: string, body: CreateRouteBody) =>
  requestJson<{ route: ApiRoute }>("/routes", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteRoute = async (token: string, routeId: string) => {
  const response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};
