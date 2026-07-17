import { createHash, randomBytes } from "node:crypto";

const OPENID_CONFIGURATION_URL =
  "https://auth.pripyat.cloud/application/o/omnia/.well-known/openid-configuration";
const AUTHENTIK_CLIENT_ID =
  process.env.AUTHENTIK_CLIENT_ID ?? "kSYcRwghR9ItrtPB5opL0lvWYPpFZfUtXFtzAv22";
export const AUTHENTIK_REDIRECT_URI =
  process.env.AUTHENTIK_REDIRECT_URI ?? "omnia://auth/callback";
const REQUEST_TIMEOUT_MS = 10_000;

type OpenIdConfiguration = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
};

type UserInfoResponse = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
};

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
};

export type AuthorizationRequest = {
  codeVerifier: string;
  state: string;
  url: string;
};

let configurationPromise: Promise<OpenIdConfiguration> | null = null;

const base64Url = (value: Buffer) =>
  value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const requestJson = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; error_description?: string; message?: string }
        | null;
      throw new Error(
        payload?.error_description ??
          payload?.message ??
          payload?.error ??
          `Authentication request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Authentik did not respond in time.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getConfiguration = () => {
  configurationPromise ??= requestJson<OpenIdConfiguration>(
    OPENID_CONFIGURATION_URL,
  );
  return configurationPromise;
};

const toAuthUser = (userInfo: UserInfoResponse): AuthUser => {
  if (!userInfo.sub || !userInfo.email) {
    throw new Error("Authentik did not return the required user identity claims.");
  }

  return {
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name ?? userInfo.preferred_username,
  };
};

export const createAuthorizationRequest = async (): Promise<AuthorizationRequest> => {
  const configuration = await getConfiguration();
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const authorizationUrl = new URL(configuration.authorization_endpoint);

  authorizationUrl.search = new URLSearchParams({
    client_id: AUTHENTIK_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    redirect_uri: AUTHENTIK_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    state,
  }).toString();

  return { codeVerifier, state, url: authorizationUrl.toString() };
};

export const completeAuthorization = async (
  callbackUrl: string,
  authorizationRequest: Pick<AuthorizationRequest, "codeVerifier" | "state">,
): Promise<AuthResponse> => {
  const callback = new URL(callbackUrl);
  const callbackError = callback.searchParams.get("error");
  if (callbackError) {
    throw new Error(
      callback.searchParams.get("error_description") ?? callbackError,
    );
  }

  const code = callback.searchParams.get("code");
  const state = callback.searchParams.get("state");
  if (!code || state !== authorizationRequest.state) {
    throw new Error("The authentication response could not be verified.");
  }

  const configuration = await getConfiguration();
  const body = new URLSearchParams({
    client_id: AUTHENTIK_CLIENT_ID,
    code,
    code_verifier: authorizationRequest.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: AUTHENTIK_REDIRECT_URI,
  });
  const tokens = await requestJson<TokenResponse>(configuration.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const user = await getCurrentUser(tokens.access_token);

  return { token: tokens.access_token, user };
};

export const getCurrentUser = async (token: string): Promise<AuthUser> => {
  const configuration = await getConfiguration();
  const userInfo = await requestJson<UserInfoResponse>(
    configuration.userinfo_endpoint,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return toAuthUser(userInfo);
};
