export function formatDate(date: Date) {
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		weekday: "long",
		year: "numeric",
	});
}
