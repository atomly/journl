import { useCallback, useEffect, useRef } from "react";

type UseIntersectionObserverOptions = IntersectionObserverInit;

export function useIntersectionObserver(
	onIntersect: () => void,
	options: UseIntersectionObserverOptions = {},
) {
	const observerRef = useRef<IntersectionObserver | null>(null);
	const targetRef = useRef<Element | null>(null);

	const setTarget = useCallback(
		(node: Element | null) => {
			// Clean up previous observer
			if (observerRef.current) {
				observerRef.current.disconnect();
			}

			// Store the new target
			targetRef.current = node;

			// Create new observer if we have a target
			if (node) {
				observerRef.current = new IntersectionObserver(
					(entries) => {
						const [entry] = entries;
						if (entry?.isIntersecting) {
							onIntersect();
						}
					},
					{
						root: options.root ?? null,
						rootMargin: options.rootMargin ?? "0px",
						threshold: options.threshold ?? 0,
					},
				);

				observerRef.current.observe(node);
			}
		},
		[onIntersect, options.threshold, options.rootMargin, options.root],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, []);

	return { setTarget };
}
