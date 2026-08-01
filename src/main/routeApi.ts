import { ApiRoute } from "../common/routeMapping";

const API_BASE_URL = (
  process.env.OMNIA_API_BASE_URL ?? "https://omnia.pripyat.cloud"
).replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 20_000;
const LIST_ROUTES_RETRY_DELAYS_MS = [750, 2_000];

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
  name?: string;
  order?: number;
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

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
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
};

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, delayMs));

export const listRoutes = async (token: string) => {
  let lastError: unknown;

  // This request is safe to repeat. Startup can race with network restoration,
  // Cloudflare, or the backend fetching Authentik's JWKS for the first time.
  for (let attempt = 0; attempt <= LIST_ROUTES_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await requestJson<{ routes: ApiRoute[] }>("/routes", token);
    } catch (error) {
      lastError = error;
      const retryDelay = LIST_ROUTES_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined) break;
      await wait(retryDelay);
    }
  }

  throw lastError;
};

export const createRoute = (token: string, body: CreateRouteBody) =>
  requestJson<{ route: ApiRoute }>("/routes", token, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateRoute = async (
  token: string,
  routeId: string,
  body: UpdateRouteBody,
) => {
  const payload = {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.order !== undefined ? { order: body.order } : {}),
  };

  if (Object.keys(payload).length === 0) {
    throw new Error("No route updates were provided.");
  }

  return requestJson<{ route: ApiRoute }>(`/routes/${routeId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

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
