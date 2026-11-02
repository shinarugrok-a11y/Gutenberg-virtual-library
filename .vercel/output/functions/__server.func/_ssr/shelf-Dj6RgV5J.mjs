//#region node_modules/.nitro/vite/services/ssr/assets/shelf-Dj6RgV5J.js
var LANGUAGES = [
	{
		id: "",
		label: "All languages"
	},
	{
		id: "en",
		label: "English"
	},
	{
		id: "fr",
		label: "French"
	},
	{
		id: "de",
		label: "German"
	},
	{
		id: "es",
		label: "Spanish"
	},
	{
		id: "it",
		label: "Italian"
	},
	{
		id: "pt",
		label: "Portuguese"
	},
	{
		id: "nl",
		label: "Dutch"
	},
	{
		id: "fi",
		label: "Finnish"
	},
	{
		id: "la",
		label: "Latin"
	},
	{
		id: "zh",
		label: "Chinese"
	}
];
var GENRES = [
	{
		id: "adventure",
		label: "Adventure",
		any: ["Category: Adventure"]
	},
	{
		id: "biography",
		label: "Biographies",
		any: ["Category: Biographies"]
	},
	{
		id: "children",
		label: "Children & young adult",
		any: ["Category: Children & Young Adult Reading"]
	},
	{
		id: "crime",
		label: "Crime & mystery",
		any: [
			"Crime",
			"Detective",
			"Mystery"
		]
	},
	{
		id: "essays",
		label: "Essays & speeches",
		any: ["Category: Essays, Letters & Speeches"]
	},
	{
		id: "history",
		label: "History",
		any: ["Category: History"]
	},
	{
		id: "horror",
		label: "Horror & gothic",
		any: ["Horror", "Gothic"]
	},
	{
		id: "humour",
		label: "Humour",
		any: ["Category: Humour"]
	},
	{
		id: "myth",
		label: "Myth & folklore",
		any: ["Category: Mythology, Legends & Folklore"]
	},
	{
		id: "novels",
		label: "Novels",
		any: ["Category: Novels"]
	},
	{
		id: "philosophy",
		label: "Philosophy & ethics",
		any: ["Category: Philosophy & Ethics"]
	},
	{
		id: "plays",
		label: "Plays & drama",
		any: ["Category: Plays/Films/Dramas"]
	},
	{
		id: "poetry",
		label: "Poetry",
		any: ["Category: Poetry"]
	},
	{
		id: "religion",
		label: "Religion & spirituality",
		any: ["Category: Religion/Spirituality"]
	},
	{
		id: "romance",
		label: "Romance",
		any: ["Category: Romance"]
	},
	{
		id: "scifi",
		label: "Science fiction & fantasy",
		any: ["Category: Science-Fiction & Fantasy"]
	},
	{
		id: "science",
		label: "Science",
		any: ["Category: Science -"]
	},
	{
		id: "short",
		label: "Short stories",
		any: ["Category: Short Stories"]
	},
	{
		id: "travel",
		label: "Travel writing",
		any: ["Category: Travel Writing"]
	}
];
function matchGenre(shelves, genreId) {
	const g = GENRES.find((item) => item.id === genreId);
	if (!g) return false;
	if (g.none?.some((part) => shelves.includes(part))) return false;
	return g.any.some((part) => shelves.includes(part));
}
function frequency(id) {
	return (88 + id * 17 % 2e3 / 100).toFixed(1);
}
function primaryShelf(shelves) {
	return shelves.split(";").map((part) => part.trim().replace(/^Category:\s*/, "")).find(Boolean) ?? "General";
}
function authorLabel(author) {
	return author.trim() || "Unknown author";
}
//#endregion
export { matchGenre as a, frequency as i, LANGUAGES as n, primaryShelf as o, authorLabel as r, GENRES as t };
