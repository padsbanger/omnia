import { Button, Description, Drawer, Label } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  type AppSettings,
  type StartupOpenMode,
} from "../../common/settings";

type SettingsDrawerProps = {
  closeDrawer: () => void;
};

const STARTUP_OPTIONS: Array<{
  value: StartupOpenMode;
  label: string;
  description: string;
}> = [
  {
    value: "yes",
    label: "Yes",
    description: "Launch Omnia automatically when you sign in.",
  },
  {
    value: "no",
    label: "No",
    description: "Do not open Omnia automatically on system startup.",
  },
  {
    value: "minimized",
    label: "Minimized",
    description: "Launch Omnia on sign-in and keep the window minimized.",
  },
];

const SettingsDrawer = ({ closeDrawer }: SettingsDrawerProps) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void window.electronAPI
      .invoke("get-app-settings")
      .then((nextSettings: AppSettings) => {
        if (isMounted) {
          setSettings(nextSettings);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleStartupModeChange = async (mode: StartupOpenMode) => {
    setIsSaving(true);

    try {
      const nextSettings = (await window.electronAPI.invoke(
        "set-startup-open-mode",
        { mode },
      )) as AppSettings;
      setSettings(nextSettings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer.Backdrop
      variant="transparent"
      isDismissable={false}
      className="z-2000"
      onClick={closeDrawer}
    >
      <Drawer.Content placement="left" className="z-2001 w-110 ml-23.25">
        <div onClick={(event) => event.stopPropagation()}>
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Settings</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <div className="flex flex-col gap-6 pr-4">
                <section className="rounded-xl border border-default-200 px-4 py-4 shadow-sm">
                  <div className="mb-4 flex flex-col gap-1">
                    <Label>Startup and window behavior</Label>
                    <Description>
                      Choose what Omnia should do when your system starts.
                    </Description>
                  </div>

                  <div className="flex flex-col gap-3">
                    {STARTUP_OPTIONS.map((option) => {
                      const isSelected =
                        settings?.startupOpenMode === option.value;

                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-default-200 hover:border-default-300"
                          } ${isSaving ? "opacity-70" : "opacity-100"}`}
                        >
                          <input
                            type="radio"
                            name="startupOpenMode"
                            className="mt-1"
                            checked={isSelected}
                            disabled={isSaving || settings === null}
                            onChange={() =>
                              void handleStartupModeChange(option.value)
                            }
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {option.label}
                            </span>
                            <span className="text-sm text-default-600">
                              {option.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <div className="flex justify-end">
                  <Button type="button" onClick={closeDrawer}>
                    Close
                  </Button>
                </div>
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </div>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
};

export default SettingsDrawer;
