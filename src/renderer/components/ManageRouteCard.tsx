import { Button, Description, Label, Tooltip } from "@heroui/react";
import { IoTrashBin } from "react-icons/io5";
import { IoIosRefresh } from "react-icons/io";
import { RiCloseFill } from "react-icons/ri";
import { Route } from "../../common/routes";
import { WindowIcon } from "./WindowIcon";

type ManageRouteCardProps = {
  route: Route;
  isEditing: boolean;
  editingLabel: string;
  isSaving: boolean;
  labelError: string | null;
  isOffline: boolean;
  onBeginEditing: (route: Route) => void;
  onCancelEditing: () => void;
  onChangeLabel: (label: string) => void;
  onCommitLabel: (route: Route) => void;
  onDelete: (routeId: string) => void;
  onToggleHibernation: (routeId: string) => void;
};

const RouteStatus = ({ route }: Pick<ManageRouteCardProps, "route">) => {
  if (route.isHibernated) return <Description>Status: hibernated</Description>;
  if (route.memoryUsage) {
    return (
      <Description>
        Memory: {(route.memoryUsage.residentSet / 1024).toFixed(1)} MB
      </Description>
    );
  }
  return <Description>Memory: measuring...</Description>;
};

const RouteEditor = ({
  editingLabel,
  isSaving,
  labelError,
  onCancelEditing,
  onChangeLabel,
  onCommitLabel,
  route,
}: Pick<
  ManageRouteCardProps,
  | "editingLabel"
  | "isSaving"
  | "labelError"
  | "onCancelEditing"
  | "onChangeLabel"
  | "onCommitLabel"
  | "route"
>) => (
  <>
    <input
      autoFocus
      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      onChange={(event) => onChangeLabel(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancelEditing();
          return;
        }
        if (event.key === "Enter") onCommitLabel(route);
      }}
      value={editingLabel}
    />
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button
        className="bg-blue-600 text-white"
        isDisabled={!editingLabel.trim().length}
        isPending={isSaving}
        onClick={() => onCommitLabel(route)}
      >
        Save
      </Button>
      <Button
        className="border border-slate-200 bg-white text-slate-700"
        onClick={onCancelEditing}
      >
        Cancel
      </Button>
      {labelError ? <Description className="text-red-700">{labelError}</Description> : null}
    </div>
  </>
);

const RouteActions = ({
  isOffline,
  onBeginEditing,
  onDelete,
  onToggleHibernation,
  route,
}: Pick<
  ManageRouteCardProps,
  | "isOffline"
  | "onBeginEditing"
  | "onDelete"
  | "onToggleHibernation"
  | "route"
>) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      Actions
    </span>
    <div className="flex flex-wrap items-center gap-2">
      <Tooltip>
        <Button
          className="border border-slate-200 bg-slate-50 text-slate-700"
          size="sm"
          onClick={() => onToggleHibernation(route.id)}
        >
          {route.isHibernated ? "Restore" : "Hibernate"}
        </Button>
        <Tooltip.Content>
          <p>{route.isHibernated ? "Wake this route and recreate its webview." : "Unload this route's webview to free memory."}</p>
        </Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          isIconOnly
          size="sm"
          className="border border-slate-200 bg-slate-50 text-slate-700"
          isDisabled={route.isHibernated}
          onClick={() => window.electronAPI.invoke("refresh-view", { route })}
        >
          <IoIosRefresh />
        </Button>
        <Tooltip.Content><p>Refresh this route.</p></Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          isIconOnly
          size="sm"
          className="border border-slate-200 bg-slate-50 text-slate-700"
          isDisabled={route.isHibernated}
          onClick={() => window.electronAPI.invoke("clear-single-partition", { route })}
        >
          <IoTrashBin />
        </Button>
        <Tooltip.Content><p>Clear site data for this route.</p></Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          size="sm"
          className="border border-slate-200 bg-slate-50 text-slate-700"
          isDisabled={isOffline}
          onClick={() => onBeginEditing(route)}
        >
          Rename
        </Button>
        <Tooltip.Content><p>Rename this route label.</p></Tooltip.Content>
      </Tooltip>
      <Tooltip>
        <Button
          isIconOnly
          size="sm"
          className="border border-slate-200 bg-slate-50 text-slate-700"
          isDisabled={isOffline}
          onClick={() => onDelete(route.id)}
        >
          <RiCloseFill />
        </Button>
        <Tooltip.Content><p>Delete this route.</p></Tooltip.Content>
      </Tooltip>
    </div>
  </div>
);

const ManageRouteCard = (props: ManageRouteCardProps) => (
  <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex flex-row gap-2">
      <WindowIcon icon={props.route.icon} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {props.isEditing ? (
          <RouteEditor {...props} />
        ) : (
          <>
            <Label className="truncate text-black">{props.route.label}</Label>
            <Description className="truncate">{props.route.loadURL}</Description>
            <RouteStatus route={props.route} />
          </>
        )}
      </div>
    </div>
    {props.isEditing ? null : <RouteActions {...props} />}
  </div>
);

export default ManageRouteCard;
