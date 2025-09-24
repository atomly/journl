"use client";

import { SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "~/auth/sign-out.action";
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
          <SignedOut>
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
          </SignedOut>
          <SignedIn>
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
          </SignedIn>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}
