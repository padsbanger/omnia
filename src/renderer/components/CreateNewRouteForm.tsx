import { useMemo, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@heroui/react";
import { Route } from "../../common/routes";
import { useAppStore } from "../store";
import {
  GOOGLE_HOSTS,
  FACEBOOK_HOSTS,
  TWITTER_HOSTS,
  SLACK_HOSTS,
  MICROSOFT_TEAMS_HOSTS,
  TRADINGVIEW_HOSTS,
  SPOTIFY_HOSTS,
} from "../../common/auth_hosts";

type CreateNewRouteFormProps = {
  closeDrawer: () => void;
  onCreateRoute?: (route: Route) => Promise<boolean>;
};

type RouteNavigationConfig = {
  internalHosts: string[];
  openExternalLinksInBrowser: boolean;
};

type ApplicationKey =
  | 'gmail'
  | 'discord'
  | 'facebook'
  | 'tradingview'
  | 'twitter'
  | 'spotify'
  | 'slack'
  | 'teams';

const APPLICATION_DEFAULTS: Record<
  ApplicationKey,
  { label: string; url: string }
> = {
  gmail: { label: 'Gmail', url: 'https://mail.google.com' },
  discord: { label: 'Discord', url: 'https://discord.com/channels/@me' },
  facebook: { label: 'Messenger', url: 'https://facebook.com/messages' },
  tradingview: { label: 'TradingView', url: 'https://www.tradingview.com' },
  twitter: { label: 'Twitter', url: 'https://twitter.com/home' },
  spotify: { label: 'Spotify', url: 'https://open.spotify.com/home' },
  slack: { label: 'Slack', url: 'https://app.slack.com/client' },
  teams: { label: 'Microsoft Teams', url: 'https://teams.microsoft.com' },
};

const buildRouteId = (label: string) =>
  `${label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;

const getRouteNavigationConfig = (
  icon: string,
  hostname: string,
): RouteNavigationConfig => {
  const lowerHost = hostname.toLowerCase();

  const isGoogleHost =
    lowerHost.endsWith('google.com') ||
    lowerHost.endsWith('gmail.com') ||
    lowerHost.endsWith('googleusercontent.com') ||
    lowerHost.endsWith('gstatic.com');

  if (icon === 'gmail' || isGoogleHost) {
    return {
      internalHosts: GOOGLE_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === 'discord' || lowerHost.endsWith('discord.com')) {
    return {
      internalHosts: ['discord.com', 'discordapp.com'],
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === 'slack' || lowerHost.endsWith('slack.com')) {
    return {
      internalHosts: [...SLACK_HOSTS, ...GOOGLE_HOSTS],
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === 'teams' ||
    lowerHost.endsWith('teams.microsoft.com') ||
    lowerHost.endsWith('teams.live.com') ||
    lowerHost.endsWith('microsoftonline.com') ||
    lowerHost.endsWith('office.com')
  ) {
    return {
      internalHosts: MICROSOFT_TEAMS_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === 'facebook' ||
    lowerHost.endsWith('facebook.com') ||
    lowerHost.endsWith('messenger.com')
  ) {
    return {
      internalHosts: FACEBOOK_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (icon === 'tradingview' || lowerHost.endsWith('tradingview.com')) {
    return {
      internalHosts: TRADINGVIEW_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  if (
    icon === 'twitter' ||
    lowerHost.endsWith('twitter.com') ||
    lowerHost.endsWith('x.com')
  ) {
    return {
      internalHosts: [...TWITTER_HOSTS, ...GOOGLE_HOSTS],
      openExternalLinksInBrowser: true,
    };
  }

  // Added Spotify logic
  if (icon === 'spotify' || lowerHost.endsWith('spotify.com')) {
    return {
      internalHosts: SPOTIFY_HOSTS,
      openExternalLinksInBrowser: true,
    };
  }

  return {
    internalHosts: [hostname],
    openExternalLinksInBrowser: true,
  };
};;;;

const CreateNewRouteForm = ({
  closeDrawer,
  onCreateRoute,
}: CreateNewRouteFormProps) => {
  const navigate = useNavigate();
  const { addRoute, setActiveTab, setActiveDrawer } = useAppStore();

  const [label, setLabel] = useState("");
  const [application, setApplication] = useState<ApplicationKey>("gmail");
  const [url, setUrl] = useState(APPLICATION_DEFAULTS.gmail.url);

  const canSubmit = useMemo(
    () => label.trim().length > 0 && url.trim().length > 0,
    [label, url],
  );

  const handleApplicationChange = (value: ApplicationKey) => {
    setApplication(value);
    setUrl(APPLICATION_DEFAULTS[value].url);
  };

  const normalizeUrl = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleCreateRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return;

    let hostname = "";
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      return;
    }

    const navigationConfig = getRouteNavigationConfig(application, hostname);

    const routeId = buildRouteId(label);
    const route: Route = {
      id: routeId,
      label: label.trim(),
      icon: application,
      path: `/${routeId}`,
      loadURL: normalizedUrl,
      partition: `persist:user-${routeId}`,
      isHibernated: false,
      internalHosts: navigationConfig.internalHosts,
      openExternalLinksInBrowser: navigationConfig.openExternalLinksInBrowser,
    };

    if (onCreateRoute) {
      const created = await onCreateRoute(route);
      if (created) {
        closeDrawer();
      }
      return;
    }

    const result = await window.electronAPI.invoke("create-route-view", {
      route,
    });

    if (result?.success) {
      addRoute(route);
      setActiveTab(route.id);
      navigate(route.path);
      setActiveDrawer(null);
      closeDrawer();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-5 py-4">
        <h2 className="text-lg font-semibold">Add route</h2>
      </div>
      <form
        className="flex flex-1 flex-col gap-3 p-5"
        onSubmit={handleCreateRoute}
      >
        <label className="text-sm flex flex-col gap-1">
          Label
          <input
            className="border rounded px-2 py-1"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Work Gmail"
            required
          />
        </label>
        <label className="text-sm flex flex-col gap-1">
          Application
          <select
            className="border rounded px-2 py-1"
            value={application}
            onChange={(event) =>
              handleApplicationChange(event.target.value as ApplicationKey)
            }
          >
            <option value="gmail">Gmail</option>
            <option value="discord">Discord</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter</option>
            <option value="tradingview">TradingView</option>
            <option value="spotify">Spotify</option>
            <option value="slack">Slack</option>
            <option value="teams">Microsoft Teams</option>
          </select>
        </label>
        <label className="text-sm flex flex-col gap-1">
          URL
          <input
            className="border rounded px-2 py-1"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="mail.google.com"
            required
          />
        </label>
        <div className="mt-auto flex gap-2 justify-end pt-2">
          <Button type="button" onClick={closeDrawer}>
            Cancel
          </Button>
          <Button type="submit" isDisabled={!canSubmit}>
            Save route
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateNewRouteForm;
