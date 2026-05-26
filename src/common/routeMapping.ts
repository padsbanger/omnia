import {
  FACEBOOK_HOSTS,
  GOOGLE_HOSTS,
  MICROSOFT_TEAMS_HOSTS,
  SLACK_HOSTS,
  SPOTIFY_HOSTS,
  TRADINGVIEW_HOSTS,
  TWITTER_HOSTS,
} from "./auth_hosts";
import { Route } from "./routes";

export type ApiRoute = {
  id: string;
  userId: string;
  name: string;
  url: string;
  icon: string | null;
  order: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type RouteNavigationConfig = {
  internalHosts: string[];
  openExternalLinksInBrowser: boolean;
};

const getRouteNavigationConfig = (
  icon: string,
  hostname: string,
): RouteNavigationConfig => {
  const lowerHost = hostname.toLowerCase();

  const isGoogleHost =
    lowerHost.endsWith("google.com") ||
    lowerHost.endsWith("gmail.com") ||
    lowerHost.endsWith("googleusercontent.com") ||
    lowerHost.endsWith("gstatic.com");

  if (icon === "gmail" || isGoogleHost) {
    return {
      internalHosts: GOOGLE_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === "discord" || lowerHost.endsWith("discord.com")) {
    return {
      internalHosts: ["discord.com", "discordapp.com"],
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === "slack" || lowerHost.endsWith("slack.com")) {
    return {
      internalHosts: [...SLACK_HOSTS, ...GOOGLE_HOSTS],
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === "teams" ||
    lowerHost.endsWith("teams.microsoft.com") ||
    lowerHost.endsWith("teams.live.com") ||
    lowerHost.endsWith("microsoftonline.com") ||
    lowerHost.endsWith("office.com")
  ) {
    return {
      internalHosts: MICROSOFT_TEAMS_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === "facebook" ||
    lowerHost.endsWith("facebook.com") ||
    lowerHost.endsWith("messenger.com")
  ) {
    return {
      internalHosts: FACEBOOK_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === "tradingview" || lowerHost.endsWith("tradingview.com")) {
    return {
      internalHosts: TRADINGVIEW_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === "twitter" ||
    lowerHost.endsWith("twitter.com") ||
    lowerHost.endsWith("x.com")
  ) {
    return {
      internalHosts: [...TWITTER_HOSTS, ...GOOGLE_HOSTS],
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === "spotify" || lowerHost.endsWith("spotify.com")) {
    return {
      internalHosts: SPOTIFY_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  return {
    internalHosts: [hostname],
    openExternalLinksInBrowser: true,
  };
};

export const normalizeRouteUrl = (rawValue: string) => {
  const trimmed = rawValue.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const createLocalRouteFromApiRoute = (apiRoute: ApiRoute): Route => {
  const icon = apiRoute.icon ?? "link";
  const hostname = new URL(apiRoute.url).hostname;
  const navigationConfig = getRouteNavigationConfig(icon, hostname);

  return {
    id: apiRoute.id,
    label: apiRoute.name,
    icon,
    path: `/${apiRoute.id}`,
    loadURL: apiRoute.url,
    partition: `persist:user-${apiRoute.id}`,
    isHibernated: false,
    internalHosts: navigationConfig.internalHosts,
    openExternalLinksInBrowser: navigationConfig.openExternalLinksInBrowser,
  };
};

export const createLocalRoute = (
  routeId: string,
  label: string,
  icon: string,
  url: string,
): Route => {
  const normalizedUrl = normalizeRouteUrl(url);
  const hostname = new URL(normalizedUrl).hostname;
  const navigationConfig = getRouteNavigationConfig(icon, hostname);

  return {
    id: routeId,
    label: label.trim(),
    icon,
    path: `/${routeId}`,
    loadURL: normalizedUrl,
    partition: `persist:user-${routeId}`,
    isHibernated: false,
    internalHosts: navigationConfig.internalHosts,
    openExternalLinksInBrowser: navigationConfig.openExternalLinksInBrowser,
  };
};
