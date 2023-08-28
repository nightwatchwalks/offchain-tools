import fs from "fs";
import randomSeed from "random-seed";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get current working diretory
const dirName = dirname(fileURLToPath(import.meta.url));

const nwGifsDir = dirName + "/../../common/nw-gifs";
const outputFolder = dirName + "/out";
const csvOutputFile = outputFolder + "/mappings.csv";
const jsonOutputFile = outputFolder + "/mappings.json";

// Get original gifs as an array
const getGifs = () => fs.readdirSync(nwGifsDir);

// Shuffle the array using the Fisher-Yates algorithm with the provided seed
const shuffleArray = (array, seed) => {
	// Create the RandomSeed object with the provided seed
	const random = randomSeed.create(seed);

	let currentIndex = array.length,
		randomIndex;

	// While there remain elements to shuffle.
	while (currentIndex != 0) {
		// Pick a remaining element.
		randomIndex = random.intBetween(0, currentIndex - 1);
		currentIndex--;

		// And swap it with the current element.
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}

	return array;
};

// Create a CSV file with the distributed gifs
const genereateMapCsv = (gifs) => {
	const csvContent = gifs.map((gif, i) => `${i + 1},${gif}`).join("\n");
	fs.writeFileSync(csvOutputFile, csvContent);
};

// Create a JSON file with the distributed gifs
const generateMapJSON = (gifs) => {
	const gifsTuple = gifs.map((gif, i) => [i + 1, gif]);
	const jsonContent = JSON.stringify(Object.values(gifsTuple));

	fs.writeFileSync(jsonOutputFile, jsonContent);
};

const main = () => {
	const seed = process.argv.slice(2)[0];
	if (!seed) {
		console.error("Please provide a seed as the first argument.");
		return;
	}

	const originalGifs = getGifs();
	const distributedGifs = shuffleArray(originalGifs, seed);

	// Create the output folder
	if (fs.existsSync(outputFolder)) fs.rmSync(outputFolder, { recursive: true });
	fs.mkdirSync(outputFolder);

	genereateMapCsv(distributedGifs);
	generateMapJSON(distributedGifs);
	console.log("Success.");
};

main();
