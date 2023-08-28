import * as dotenv from "dotenv";
import fs from "fs";
import got from "got";

import { dirname } from "path";
import { fileURLToPath } from "url";

async function main() {
	// Get all sets and frames from generated token data json file
	let tokenData;
	try {
		tokenData = JSON.parse(fs.readFileSync("./tokenData.json"));
	} catch (err) {
		console.error("No tokenData.json found in the script directory!");
		return;
	}

	console.log("Looping through all the tokens and finding mergeable ones...");

	// Load environment variables
	dotenv.config();

	// Get owners and their tokens using Alchemy NFT API
	const alchemyApiUrlBase = process.env.ALCHEMY_API_URL_BASE;
	const contractAddress = process.env.CONTRACT_ADDRESS;
	const alchemyApiUrl = `${alchemyApiUrlBase}/getOwnersForCollection?contractAddress=${contractAddress}&withTokenBalances=true`;
	const response = await got(alchemyApiUrl).json();
	const owners = response.ownerAddresses;

	// Initialize the applicable array
	let applicable = [];

	// Loop through all the owners and check if they have mergeable tokens
	for (const owner of owners) {
		const tokenBalances = owner.tokenBalances;
		const applicableTokens = new Map();

		// Skip if the owner has only one token
		if (tokenBalances.length <= 1) continue;

		// Loop through all the tokens and check if they are mergeable
		for (const tokenBalance of tokenBalances) {
			const tokenId = parseInt(tokenBalance.tokenId, 16);
			if (tokenId >= 6825) break;

			// Get the set of the token
			const set = tokenData[tokenId][0];

			// If the set is not in the applicable set, add it with the token
			if (!applicableTokens.has(set)) applicableTokens.set(set, [tokenId]);
			// If the set is in the applicable set, add the token
			else applicableTokens.get(set).push(tokenId);
		}

		// If the applicable set has more than one token, add it to the applicable array
		if (applicableTokens.size > 0) {
			applicable = applicable.concat(Array.from(applicableTokens.values()).filter((x) => x.length > 1));
		}
	}

	// Write the applicable wallets to a file
	const dirName = dirname(fileURLToPath(import.meta.url));
	const outputFolder = dirName + "/out";

	// Create output folder
	if (fs.existsSync(outputFolder)) fs.rmSync(outputFolder, { recursive: true });
	fs.mkdirSync(outputFolder);
	fs.writeFileSync(outputFolder + "/applicable.json", JSON.stringify(applicable));
	const explodedArrays = explodeArray(applicable);
	for (let i = 0; i < explodedArrays.length; i++) {
		const explode = explodedArrays[i];
		fs.writeFileSync(outputFolder + `/applicable-${i}.json`, JSON.stringify(explode));
	}
	console.log("Mergeable wallets written to the output folder.");
}

// Explodes an array into an array of arrays of size 50
function explodeArray(arr) {
	const n = arr.length;
	const m = 50; // maximum size of each subarray
	const numSubarrays = Math.ceil(n / m);
	const subarrays = new Array(numSubarrays);

	for (let i = 0; i < numSubarrays; i++) {
		const start = i * m;
		const end = Math.min(start + m, n);
		const subarray = new Array(end - start);
		for (let j = start; j < end; j++) {
			subarray[j - start] = arr[j];
		}
		subarrays[i] = subarray;
	}

	return subarrays;
}

main();
