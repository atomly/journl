"use client";

import type { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { Select as SelectPrimitive } from "@base-ui/react/select";
import type { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import type { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from "react";

type Placement<
  P extends {
    align?: unknown;
    alignOffset?: unknown;
    side?: unknown;
    sideOffset?: unknown;
  },
  Portal extends { container?: unknown },
> = Pick<P, "align" | "alignOffset" | "side" | "sideOffset"> &
  Pick<Portal, "container">;
type MenuContent = MenuPrimitive.Popup.Props &
  Placement<MenuPrimitive.Positioner.Props, MenuPrimitive.Portal.Props> & {
    positionerClassName?: string;
  };
type MenuItem = MenuPrimitive.Item.Props & {
  asChild?: boolean;
  inset?: boolean;
  variant?: "default" | "destructive";
};

/** Base UI interaction contracts plus the small styling vocabulary used by our controls.
 * Adapters must forward refs, render props, events and focus/portal options unchanged.
 */
export type EditorUIComponents = {
  SurfaceButton: ComponentType<ButtonPrimitive.Props>;
  Input: ComponentType<ComponentProps<"input">>;
  Button: ComponentType<
    ButtonPrimitive.Props & {
      asChild?: boolean;
      size?: "default" | "sm" | "icon" | "icon-sm";
      variant?: "default" | "ghost" | "outline";
    }
  >;
  DropdownMenu: ComponentType<MenuPrimitive.Root.Props>;
  DropdownMenuContent: ComponentType<MenuContent>;
  DropdownMenuGroup: ComponentType<MenuPrimitive.Group.Props>;
  DropdownMenuItem: ComponentType<MenuItem>;
  DropdownMenuLabel: ComponentType<
    MenuPrimitive.GroupLabel.Props & { inset?: boolean }
  >;
  DropdownMenuSeparator: ComponentType<MenuPrimitive.Separator.Props>;
  DropdownMenuSub: ComponentType<MenuPrimitive.SubmenuRoot.Props>;
  DropdownMenuSubContent: ComponentType<MenuContent>;
  DropdownMenuSubTrigger: ComponentType<
    MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }
  >;
  DropdownMenuTrigger: ComponentType<
    MenuPrimitive.Trigger.Props & { asChild?: boolean }
  >;
  Popover: ComponentType<PopoverPrimitive.Root.Props>;
  PopoverContent: ComponentType<
    PopoverPrimitive.Popup.Props &
      Placement<
        PopoverPrimitive.Positioner.Props,
        PopoverPrimitive.Portal.Props
      >
  >;
  PopoverTrigger: ComponentType<PopoverPrimitive.Trigger.Props>;
  Select: typeof SelectPrimitive.Root;
  SelectContent: ComponentType<
    SelectPrimitive.Popup.Props &
      Placement<
        SelectPrimitive.Positioner.Props,
        SelectPrimitive.Portal.Props
      > & { alignItemWithTrigger?: boolean }
  >;
  SelectItem: ComponentType<SelectPrimitive.Item.Props>;
  SelectTrigger: ComponentType<
    SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }
  >;
  SelectValue: ComponentType<SelectPrimitive.Value.Props>;
  Tooltip: ComponentType<TooltipPrimitive.Root.Props>;
  TooltipContent: ComponentType<
    TooltipPrimitive.Popup.Props &
      Placement<
        TooltipPrimitive.Positioner.Props,
        TooltipPrimitive.Portal.Props
      >
  >;
  TooltipProvider: ComponentType<TooltipPrimitive.Provider.Props>;
  TooltipTrigger: ComponentType<
    TooltipPrimitive.Trigger.Props & { asChild?: boolean }
  >;
  ToolbarRoot: ComponentType<ToolbarPrimitive.Root.Props>;
  ToolbarButton: ComponentType<ToolbarPrimitive.Button.Props>;
};

const EditorUIContext = createContext<EditorUIComponents | null>(null);

export function EditorUIProvider({
  components,
  children,
}: {
  components: EditorUIComponents;
  children: ReactNode;
}) {
  return (
    <EditorUIContext.Provider value={components}>
      {children}
    </EditorUIContext.Provider>
  );
}

export function useEditorUI(): EditorUIComponents {
  const components = useContext(EditorUIContext);
  if (!components)
    throw new Error(
      "Wrap DocumentEditor in EditorUIProvider with a UI adapter.",
    );
  return components;
}

// Stable component identities preserve popup and focus state between renders.
// React 19 forwards ref as a prop, along with the remaining adapter contract.
function component<K extends keyof EditorUIComponents>(
  name: K,
): EditorUIComponents[K] {
  function EditorUIComponent(props: Record<string, unknown>) {
    const Component = useEditorUI()[name] as ComponentType<
      Record<string, unknown>
    >;
    return createElement(Component, props);
  }
  EditorUIComponent.displayName = `EditorUI.${name}`;
  return EditorUIComponent as EditorUIComponents[K];
}
export const Button = component("Button");
export const DropdownMenu = component("DropdownMenu");
export const DropdownMenuContent = component("DropdownMenuContent");
export const DropdownMenuGroup = component("DropdownMenuGroup");
export const DropdownMenuItem = component("DropdownMenuItem");
export const DropdownMenuLabel = component("DropdownMenuLabel");
export const DropdownMenuSeparator = component("DropdownMenuSeparator");
export const DropdownMenuSub = component("DropdownMenuSub");
export const DropdownMenuSubContent = component("DropdownMenuSubContent");
export const DropdownMenuSubTrigger = component("DropdownMenuSubTrigger");
export const DropdownMenuTrigger = component("DropdownMenuTrigger");
export const Popover = component("Popover");
export const PopoverContent = component("PopoverContent");
export const PopoverTrigger = component("PopoverTrigger");
export const Select = component("Select");
export const SelectContent = component("SelectContent");
export const SelectItem = component("SelectItem");
export const SelectTrigger = component("SelectTrigger");
export const SelectValue = component("SelectValue");
export const Tooltip = component("Tooltip");
export const TooltipContent = component("TooltipContent");
export const TooltipProvider = component("TooltipProvider");
export const TooltipTrigger = component("TooltipTrigger");
export const Toolbar = {
  Button: component("ToolbarButton"),
  Root: component("ToolbarRoot"),
};

export const SurfaceButton = component("SurfaceButton");
export const Input = component("Input");
