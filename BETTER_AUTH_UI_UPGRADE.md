# Better Auth UI Upgrade Documentation

## Overview

This document outlines the upgrade to `@daveyplate/better-auth-ui` v3.2.5 and the associated refactoring of authentication components throughout the application.

## Changes Summary

### Package Updates
- **better-auth-ui**: Upgraded to `~3.2.5`
- **better-auth**: Updated to latest version with improved plugin support

### Major Refactoring

#### 1. Modal Renaming
- **Before**: `@billingModal` 
- **After**: `@subscriptionModal`
- **Rationale**: More accurate naming that reflects the actual functionality (subscription management vs billing)

#### 2. Authentication Component Modernization
- Migrated from custom auth components to `@daveyplate/better-auth-ui` primitives
- Implemented `AuthUIProvider` for centralized auth state management
- Added proper TypeScript types and improved type safety

#### 3. New Account Management
- Added dedicated account view component: `apps/web/src/app/(dashboard)/account/[pathname]/_components/account-view.tsx`
- Implemented account page routing: `apps/web/src/app/(dashboard)/account/[pathname]/page.tsx`

## Technical Details

### Better Auth Provider Configuration

```typescript
// apps/web/src/components/auth/better-auth-provider.tsx
export function BetterAuthProvider({ children, Link }: AuthProviderProps) {
  const router = useRouter();
  return (
    <AuthUIProvider
      basePath="/auth"           // Auth views path
      account                   // Account views enabled
      organization={false}      // Organization features disabled
      credentials={false}       // Credentials auth disabled
      social={{
        providers: ["google", "github"], // Supported OAuth providers
      }}
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        router.refresh(); // Clear router cache for protected routes
      }}
      Link={Link}
    >
      {children}
    </AuthUIProvider>
  );
}
```

### Auth View Components

#### Dashboard Auth View
```typescript
// apps/web/src/app/(dashboard)/auth/[pathname]/_components/auth-view.tsx
export async function AuthView({ pathname }: { pathname: string }) {
  if (!AUTH_VIEWS.has(pathname)) {
    redirect("/");
  }

  return (
    <PrimitiveAuthView
      className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
      pathname={pathname}
      redirectTo="/journal"
      localization={{
        SIGN_IN: "Sign in",
        SIGN_UP: "Sign up",
      }}
    />
  );
}
```

#### Account View Component
```typescript
// apps/web/src/app/(dashboard)/account/[pathname]/_components/account-view.tsx
export async function AuthView({ pathname }: { pathname: string }) {
  if (!ACCOUNT_VIEWS.has(pathname)) {
    redirect("/");
  }

  return (
    <PrimitiveAuthView
      className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
      pathname={pathname}
      redirectTo="/journal"
      localization={{
        ACCOUNT: "Account",
        PROFILE: "Profile",
        SECURITY: "Security",
        BILLING: "Billing",
      }}
    />
  );
}
```

### Auth Server Configuration Updates

#### Enhanced Account Linking
```typescript
// packages/auth/src/index.ts
const config = {
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "discord"],
    },
  },
  // ... other configuration
};
```

#### Improved Plugin Support
- Updated Stripe integration
- Enhanced OAuth proxy configuration
- Better organization plugin support

## File Structure Changes

### Removed Files
- `apps/web/src/app/(app)/@billingModal/_components/billing-error-boundary.tsx`
- `apps/web/src/app/(app)/@billingModal/default.tsx`

### Renamed Files
- `@billingModal` → `@subscriptionModal` (entire directory)
- Updated all references throughout the codebase

### New Files
- `apps/web/src/app/(app)/@subscriptionModal/default.tsx`
- `apps/web/src/app/(dashboard)/account/[pathname]/_components/account-view.tsx`
- `apps/web/src/app/(dashboard)/account/[pathname]/page.tsx`

## Benefits of the Upgrade

### 1. Improved Developer Experience
- Better TypeScript support with proper type definitions
- Cleaner component APIs with reduced boilerplate
- Enhanced error handling and validation

### 2. Better User Experience
- Consistent UI patterns across auth flows
- Improved accessibility features
- Better mobile responsiveness

### 3. Maintainability
- Reduced custom auth code
- Standardized patterns using better-auth-ui primitives
- Easier to update and maintain auth flows

### 4. Security Improvements
- Enhanced account linking capabilities
- Better session management
- Improved OAuth flow handling

## Migration Notes

### Breaking Changes
1. **Modal Naming**: All references to `@billingModal` must be updated to `@subscriptionModal`
2. **Component Props**: Some auth component props have changed - check TypeScript errors
3. **Routing**: New account routes require proper configuration

### Configuration Updates Required
1. **Environment Variables**: Some auth-related env vars may need updates
2. **Database Schema**: Account linking features may require schema updates
3. **OAuth Providers**: Verify Google and GitHub OAuth configurations

## Testing Checklist

- [ ] Sign in flow works correctly
- [ ] Sign up flow works correctly  
- [ ] Account management pages load properly
- [ ] Subscription modal functions correctly
- [ ] OAuth providers (Google, GitHub) work
- [ ] Account linking between providers works
- [ ] Session management and refresh works
- [ ] Mobile responsiveness is maintained
- [ ] TypeScript compilation passes
- [ ] No console errors in browser

## Future Considerations

1. **Organization Features**: Currently disabled but can be enabled if needed
2. **Credentials Auth**: Currently disabled - consider if email/password auth is needed
3. **Additional OAuth Providers**: Discord is configured but not enabled in UI
4. **Custom Styling**: May need additional CSS customization for brand consistency

## Rollback Plan

If issues arise, the upgrade can be rolled back by:
1. Reverting the commit: `git revert 4446a2c`
2. Restoring the old package versions in `package.json`
3. Running `pnpm install` to restore dependencies

## Related Documentation

- [Better Auth UI Documentation](https://github.com/daveyplate/better-auth-ui)
- [Better Auth Documentation](https://www.better-auth.com/)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
