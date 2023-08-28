import randomSeed from "random-seed";
import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

// Get current working diretory
const dirName = dirname(fileURLToPath(import.meta.url));
const outputFolder = dirName + "/out";
const outputFile = outputFolder + "/tokenData.json";
const uint24OutputFile = outputFolder + "/tokenDataUint24.json";

const tuplesEqual = (a, b) => a[0] === b[0] && a[1] === b[1];

const generateTokenData = (seed) => {
	const tokenData = [];

	// Create the RandomSeed object with the provided seed
	const random = randomSeed.create(seed);

	let attemptCount = 0;
	let duplicateCount = 0;

	mainLoop: while (tokenData.length < 6825) {
		attemptCount++;
		// Get a number between 1 (inclusive) and 455 (inclusive)
		const first = random.intBetween(1, 455);
		// Get a number between 0 (inclusive) and 14 (inclusive)
		const second = random.intBetween(0, 14);

		const tuple = [first, second];

		// Check if the tuple is already in the array
		for (let otherTuple of tokenData) {
			if (tuplesEqual(otherTuple, tuple)) {
				duplicateCount++;
				continue mainLoop;
			}
		}

		// If not, add it to the array
		tokenData.push(tuple);
	}

	console.log("Attempt Count:", attemptCount);
	console.log("Duplicate Count:", duplicateCount);

	return tokenData;
};

const translateTokenDataAsUint24Array = (tokenData) => {
	const uint24Array = [];

	for (const data of tokenData) {
		const set = data[0];
		const frame = data[1];

		// Convert set into binary number
		const setBinary = set.toString(2).padStart(9, "0");

		// Initialize frame binary array
		let frameBinary = "000000000000000";

		// Change (14 - frame)th character to 1 to add the frame into binary array
		frameBinary = `${frameBinary.substr(0, 14 - frame)}1${frameBinary.substr(14 - frame + 1)}`;

		// Combine the set and frame binary numbers
		const binary = setBinary + frameBinary;

		// Convert the binary number to a uint24
		const uint24 = parseInt(binary, 2);

		// Add the uint24 to the array
		uint24Array.push(uint24);
	}

	return uint24Array;
};

const main = () => {
	const seed = process.argv.slice(2)[0];
	if (!seed) {
		console.error("Please provide a seed as the first argument.");
		return;
	}

	// Generate the token data
	const tokenData = generateTokenData(seed);

	// Create the output folder
	if (fs.existsSync(outputFolder)) fs.rmSync(outputFolder, { recursive: true });
	fs.mkdirSync(outputFolder);

	// Write the token data to a file
	fs.writeFileSync(outputFile, JSON.stringify(tokenData));

	// Generate the token data as a uint24 array and write it to a file
	const tokenDataUint24 = translateTokenDataAsUint24Array(tokenData);
	const jsonObj = {};
	for (let i = 0; i < 10; i++) {
		// Fill jsonObj with batch1 to batch10
		jsonObj[`batch${i + 1}`] = tokenDataUint24.slice(i * 682, (i + 1) * 682);

		if (i === 9) {
			// Add the remaining 5 token data to batch10
			jsonObj[`batch${i + 1}`] = jsonObj[`batch${i + 1}`].concat(tokenDataUint24.slice(6820, 6825));
		}
	}
	fs.writeFileSync(uint24OutputFile, JSON.stringify(tokenDataUint24));

	for (let i = 0; i < 10; i++) {
		fs.writeFileSync(outputFolder + "/tokenData_" + (i + 1) + ".json", JSON.stringify(jsonObj[`batch${i + 1}`]));
	}

	console.log("Success.");
};

main();
