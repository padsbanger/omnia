import { useMemo, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, Button } from "@heroui/react";
import { Route } from "../../common/routes";
import { useAppStore } from "../store";

type CreateNewRouteFormProps = {
  closeDrawer: () => void;
};

const buildRouteId = (label: string) =>
  `${label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now().toString(36)}`;

const CreateNewRouteForm = ({ closeDrawer }: CreateNewRouteFormProps) => {
  const navigate = useNavigate();
  const { addRoute, setActiveTab } = useAppStore();

  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("gmail");

  const canSubmit = useMemo(
    () => label.trim().length > 0 && url.trim().length > 0,
    [label, url],
  );

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

    const routeId = buildRouteId(label);
    const route: Route = {
      id: routeId,
      label: label.trim(),
      icon,
      path: `/${routeId}`,
      loadURL: normalizedUrl,
      partition: `persist:user-${routeId}`,
      internalHosts: [hostname],
      openExternalLinksInBrowser: true,
    };

    const result = await window.electronAPI.invoke("create-route-view", {
      route,
    });

    if (result?.success) {
      addRoute(route);
      setActiveTab(route.id);
      navigate(route.path);
      closeDrawer();
    }
  };

  return (
    <Drawer.Backdrop
      variant="transparent"
      isDismissable={false}
      className="z-2000"
      onClick={closeDrawer}
    >
      <Drawer.Content placement="left" className="z-2001 w-90 ml-23.25">
        <div onClick={(event) => event.stopPropagation()}>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Add route</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <form
                className="flex flex-col gap-3"
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
                  URL
                  <input
                    className="border rounded px-2 py-1"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="mail.google.com"
                    required
                  />
                </label>

                <label className="text-sm flex flex-col gap-1">
                  Icon
                  <select
                    className="border rounded px-2 py-1"
                    value={icon}
                    onChange={(event) => setIcon(event.target.value)}
                  >
                    <option value="gmail">Gmail</option>
                    <option value="discord">Discord</option>
                    <option value="facebook">Facebook</option>
                    <option value="tradingview">TradingView</option>
                  </select>
                </label>

                <div className="flex gap-2 justify-end mt-2">
                  <Button type="button" variant="outline" onClick={closeDrawer}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isDisabled={!canSubmit}
                  >
                    Save route
                  </Button>
                </div>
              </form>
            </Drawer.Body>
          </Drawer.Dialog>
        </div>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};

export default CreateNewRouteForm;
