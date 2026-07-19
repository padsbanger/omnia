import { ApiRoute } from "../common/routeMapping";

const API_BASE_URL = (
  process.env.OMNIA_API_BASE_URL ?? "https://omnia.pripyat.cloud"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 10_000;

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

type UpdateRouteBody = {
  name: string;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The Omnia backend did not respond in time.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

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

export const updateRoute = (token: string, routeId: string, body: UpdateRouteBody) =>
  requestJson<{ route: ApiRoute }>(`/routes/${routeId}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteRoute = async (token: string, routeId: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/routes/${routeId}`, {
      method: "DELETE",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The Omnia backend did not respond in time.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
};
