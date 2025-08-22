/**
 * A map that creates a default value if the key is not found.
 */
export class DefaultMap<K, V> extends Map<K, V> {
	constructor(
		private factory: () => V,
		...params: ConstructorParameters<typeof Map<K, V>>
	) {
		super(...params);
	}

	get(key: K): V {
		const value = super.get(key);
		if (!value) {
			const value = this.factory();
			this.set(key, value);
			return value;
		}
		return value;
	}
}
