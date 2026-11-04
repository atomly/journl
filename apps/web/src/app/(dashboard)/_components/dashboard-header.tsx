"use client";

import { Button } from "@acme/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@acme/ui/navigation-menu";
import { cn } from "@acme/ui/utils";
import { useSession } from "@better-auth-ui/react";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "~/app/_actions/sign-out.action";
import { authClient } from "~/auth/client";
import { SaveStatus } from "~/components/editor/save-status";

type UserHeaderProps = {
  className?: string;
};

function SessionGate({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: ReactNode;
}) {
  const { data, isPending } = useSession(authClient);
  if (isPending || Boolean(data?.user) !== authenticated) return null;
  return children;
}

export function DashboardHeader({ className }: UserHeaderProps) {
  return (
    <header
      className={cn(
        "container flex w-full flex-row items-center justify-between rounded-none border p-2 sm:rounded-lg md:p-4",
        className,
      )}
    >
      <div className="flex flex-row items-center">
        <div className="flex flex-row items-center gap-x-2">
          <span className="font-bold text-xl">Dashboard</span>
        </div>
      </div>
      <NavigationMenu
        className="mx-auto flex max-w-svw flex-1 justify-between [&>div]:w-full"
        viewport={false}
      >
        <NavigationMenuList className="w-full justify-end gap-x-2">
          <SessionGate authenticated={false}>
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                render={
                  <Link href="/">
                    <div className="flex flex-row items-center gap-x-2">
                      <ArrowLeft />
                      Go back
                    </div>
                  </Link>
                }
              />
            </NavigationMenuItem>
          </SessionGate>
          <SessionGate authenticated>
            <SaveStatus />
            <NavigationMenuItem>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                render={
                  <Link href="/journal">
                    <div className="flex flex-row items-center gap-x-2">
                      <ArrowLeft />
                      Go back
                    </div>
                  </Link>
                }
              />
            </NavigationMenuItem>
            <NavigationMenuItem onClick={signOutAction}>
              <NavigationMenuLink
                className={navigationMenuTriggerStyle()}
                render={
                  <Button
                    className="flex flex-row items-center gap-x-2"
                    variant="ghost"
                    onClick={signOutAction}
                  >
                    <LogOut />
                    Sign out
                  </Button>
                }
              />
            </NavigationMenuItem>
          </SessionGate>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}
