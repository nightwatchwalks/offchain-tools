import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "node:child_process";
import gifsicle from "gifsicle";

// Get current working diretory
const dirName = dirname(fileURLToPath(import.meta.url));
const nwGifsDir = dirName + "/../../common/nw-gifs/";
const compressedNwGifsDir = dirName + "/../../common/compressed-nw-gifs/";

async function main() {
	// Create compressed-nw-gifs folder
	if (fs.existsSync(compressedNwGifsDir)) fs.rmSync(compressedNwGifsDir, { recursive: true });
	fs.mkdirSync(compressedNwGifsDir);

	// Compress gifs
	const files = fs.readdirSync(nwGifsDir);
	for (const file of files) {
		await compressGif(nwGifsDir + file, compressedNwGifsDir + file);
	}

	console.log("All gifs optimized!");
}

async function compressGif(gifPath, destinationPath) {
	try {
		execFileSync(gifsicle, ["--optimize=1", "--interlace", "--lossy=100", "-o", destinationPath, gifPath]);
		console.log(gifPath + " optimized.");
	} catch (e) {
		throw e;
	}
}

main();
