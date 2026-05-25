const API_BASE_URL = "https://omnia-backend-production.up.railway.app";

type AuthRequestBody = {
  email: string;
  password: string;
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
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
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  return (await response.json()) as T;
};

export const registerUser = ({ email, password }: AuthRequestBody) =>
  requestJson("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const loginUser = ({ email, password }: AuthRequestBody) =>
  requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getCurrentUser = (token: string) =>
  requestJson("/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
