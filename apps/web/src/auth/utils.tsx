import { redirect } from "next/navigation";
import { getSession } from "~/auth/server";

/**
 * Configuration options for authentication HoCs
 */
interface AuthHocOptions {
	redirectTo?: string;
}

/**

 * @param Component - The component to wrap
 * @param options - Configuration options
 * @returns A wrapped component that requires authentication

 */
export function withAuth<P extends object>(
	Component: React.ComponentType<P>,
	options: AuthHocOptions = {},
) {
	const { redirectTo = "/" } = options;

	return async function AuthenticatedComponent(props: P) {
		const session = await getSession();

		if (!session) {
			redirect(redirectTo);
		}

		return <Component {...props} />;
	};
}

/**
 * Higher-Order Component that requires no authentication.
 * Redirects to the specified path (default: "/home") if the user is authenticated.
 *
 * @param Component - The component to wrap
 * @param options - Configuration options
 * @returns A wrapped component that requires no authentication
 */
export function withoutAuth<P extends object>(
	Component: React.ComponentType<P>,
	options: AuthHocOptions = {},
) {
	const { redirectTo = "/journal" } = options;

	return async function UnauthenticatedComponent(props: P) {
		const session = await getSession();

		if (session) {
			redirect(redirectTo);
		}

		return <Component {...props} />;
	};
}
