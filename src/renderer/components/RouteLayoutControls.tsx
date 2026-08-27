import { Button, Description, Label } from "@heroui/react";
import { WindowLayout } from "../../common/drawer";

type RouteLayoutControlsProps = {
  windowLayout: WindowLayout;
  onWindowLayoutChange: (windowLayout: WindowLayout) => void;
};

const layoutButtonClass = (isActive: boolean) =>
  isActive
    ? "bg-blue-600 text-white"
    : "border border-slate-200 bg-white text-slate-700";

const LayoutButton = ({
  currentLayout,
  label,
  layout,
  onWindowLayoutChange,
}: {
  currentLayout: WindowLayout;
  label: string;
  layout: "spread" | "matrix";
  onWindowLayoutChange: (windowLayout: WindowLayout) => void;
}) => (
  <Button
    type="button"
    className={layoutButtonClass(currentLayout === layout)}
    onClick={() =>
      onWindowLayoutChange(currentLayout === layout ? "single" : layout)
    }
  >
    {label}
  </Button>
);

const RouteLayoutControls = ({
  onWindowLayoutChange,
  windowLayout,
}: RouteLayoutControlsProps) => (
  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div className="flex flex-col">
      <Label>Window layout</Label>
      <Description>Spread all routes evenly in a single window.</Description>
    </div>
    <div className="flex gap-2">
      <LayoutButton
        currentLayout={windowLayout}
        label="Columns"
        layout="spread"
        onWindowLayoutChange={onWindowLayoutChange}
      />
      <LayoutButton
        currentLayout={windowLayout}
        label="Matrix"
        layout="matrix"
        onWindowLayoutChange={onWindowLayoutChange}
      />
    </div>
  </div>
);

export default RouteLayoutControls;
