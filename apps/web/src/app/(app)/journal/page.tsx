import { authGuard } from "~/auth/server";
import Editor from "~/components/editor";

export default async function JournalPage() {
	const _session = await authGuard();

	return <Editor />;
}
