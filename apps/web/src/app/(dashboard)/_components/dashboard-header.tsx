"use client";

import { useSession } from "@better-auth-ui/react";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "~/app/_actions/sign-out.action";
import { authClient } from "~/auth/client";
import { Button } from "~/components/ui/button";

import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import { cn } from "~/lib/cn";

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
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link href="/">
                  <div className="flex flex-row items-center gap-x-2">
                    <ArrowLeft />
                    Go back
                  </div>
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </SessionGate>
          <SessionGate authenticated>
            <NavigationMenuItem>
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Link href="/journal">
                  <div className="flex flex-row items-center gap-x-2">
                    <ArrowLeft />
                    Go back
                  </div>
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem onClick={signOutAction}>
              <NavigationMenuLink
                asChild
                className={navigationMenuTriggerStyle()}
              >
                <Button
                  className="flex flex-row items-center gap-x-2"
                  variant="ghost"
                  onClick={signOutAction}
                >
                  <LogOut />
                  Sign out
                </Button>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </SessionGate>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}
