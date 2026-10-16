/** Navigation itself is excluded from the isolated editor benchmark. */
const router = { push: (_href: string) => {} };
export const useRouter = () => router;
