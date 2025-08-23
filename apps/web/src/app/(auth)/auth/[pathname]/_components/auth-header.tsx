import { SignedIn, SignedOut } from "@daveyplate/better-auth-ui";
import { ArrowLeft, BookOpen, LogOut } from "lucide-react";
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

export function AuthHeader() {
  return (
    <header className="container mx-auto w-full flex-0 flex-row items-center justify-between p-4 pb-0! md:p-6">
      <NavigationMenu
        className="mx-auto flex max-w-svw flex-1 justify-between rounded-lg border p-2 md:p-4 [&>div]:w-full"
        viewport={false}
      >
        <div className="hidden flex-row items-center sm:flex">
          <div className="flex flex-row items-center gap-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-foreground">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <span className="font-bold text-xl">Journl</span>
          </div>
        </div>
        <NavigationMenuList className="w-full justify-between gap-x-2 sm:justify-end">
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
