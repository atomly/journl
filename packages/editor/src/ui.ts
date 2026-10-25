"use client";

import { Button } from "@acme/ui/button";
import * as menu from "@acme/ui/dropdown-menu";
import { Input } from "@acme/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@acme/ui/tooltip";
import { Button as SurfaceButton } from "@base-ui/react/button";
import { Toolbar } from "@base-ui/react/toolbar";
import type { EditorUIComponents } from "./ui-components";

/** Journl's shared, themed Base UI components. Supply overrides once at the provider. */
export const editorUI = {
  Button,
  DropdownMenu: menu.DropdownMenu,
  DropdownMenuContent: menu.DropdownMenuContent,
  DropdownMenuGroup: menu.DropdownMenuGroup,
  DropdownMenuItem: menu.DropdownMenuItem,
  DropdownMenuLabel: menu.DropdownMenuLabel,
  DropdownMenuSeparator: menu.DropdownMenuSeparator,
  DropdownMenuSub: menu.DropdownMenuSub,
  DropdownMenuSubContent: menu.DropdownMenuSubContent,
  DropdownMenuSubTrigger: menu.DropdownMenuSubTrigger,
  DropdownMenuTrigger: menu.DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SurfaceButton,
  ToolbarButton: Toolbar.Button,
  ToolbarRoot: Toolbar.Root,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} satisfies EditorUIComponents;
