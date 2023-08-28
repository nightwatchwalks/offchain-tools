import * as dotenv from "dotenv";
import got from "got";

import S3 from "../../../common/classes/s3.js";
import Web3 from "../../../common/classes/web3.js";
import Visual from "../../../common/classes/visual.js";
import Cache from "../../../common/classes/cache.js";

class ImageGeneration {
	s3;
	web3;
	visual;
	cache;

	constructor() {
		// Load environment variables
		dotenv.config();

		// Initialize classes
		this.cache = new Cache();
		this.s3 = new S3();
		this.web3 = new Web3(this.cache);
		this.visual = new Visual();
	}

	async getImageRoute(tokenId) {
		let generating = false;
		try {
			if (!tokenId || Number.isNaN(tokenId)) return { error: "Invalid token id" };

			if (!(await this.web3.isTokenExists(tokenId))) return { error: "Invalid token id" };

			// Get set and frames
			const set = await this.web3.getSet(tokenId);
			const frames = await this.web3.getFrames(tokenId);

			// Get image url
			const imageUrl = await this.getImageUrl(set, frames);

			// Check if image in the imageUrl exists, return if it does
			if (imageUrl) {
				console.log("Image exist! Returning the image.");
				return { image: imageUrl };
			}

			console.log("Image does not exist. Generating.");

			generating = true;
			await this.cache.set("generating_" + tokenId, "true", 40);

			// Delete old gifs
			await this.deleteOldGifs(tokenId);

			// Generate image
			const generatedGif = await this.visual.generateGif(set, frames);

			// Upload it to s3, so we can return faster next time
			const fileName = `generated-gifs/${set}_${frames}.gif`;
			const uploadedFile = await this.s3.upload(fileName, generatedGif);
			console.log(`${fileName} uploaded to s3.`);

			// Send the generated gif as response
			console.log(`Image for ${tokenId} generated.`);

			return { image: uploadedFile.Location };
		} catch (e) {
			if (process.env.NODE_ENV === "development") {
				console.error(e);
				return { error: e.message };
			} else {
				console.error("Image route error happened. Token id:", tokenId);
				return { error: "An error occured during request! Please contact admins." };
			}
		} finally {
			if (generating) {
				await this.cache.set("generating_" + tokenId, "false", 10);
			}
		}
	}

	async getImageUrl(set, frames) {
		// If the set id is 0 or the frames array is empty, return the burned image url
		if (frames.length === 0 || set === 0) {
			return process.env.BURN_IMAGE_URL;
		}

		// Try to get the image from s3 and return it if it exists
		try {
			const url = `${process.env.GENERATED_GIFS_URL}/${set}_${frames}.gif`;
			const gifFile = await got(url);
			if (gifFile.statusCode === 200) {
				return url;
			}
		} catch (e) {
			if (process.env.NODE_ENV === "development") console.error(e);
		}

		return null;
	}

	async deleteOldGifs(tokenId) {
		const contractCreationBlock = process.env.CONTRACT_CREATION_BLOCK;

		if (!this.web3.contract) {
			await this.web3.fetchAbiAndCreateContract();
		}

		const eventFilter = this.web3.contract.filters.Merge(tokenId);
		const events = await this.web3.contract.queryFilter(eventFilter, contractCreationBlock, "latest");

		if (events.length === 0) return;

		// Get the event with biggest blockNumber
		let event = events.reduce((prev, current) => (prev.blockNumber > current.blockNumber ? prev : current));

		const { tokenId: tokenIdEvent, tokenIdBurned, oldTokenData, updatedTokenData, owner } = event.args;

		const set = updatedTokenData >> 15;

		const newFrames = updatedTokenData.toNumber().toString(2).slice(9).split("").reverse();
		const oldFrames = oldTokenData.toNumber().toString(2).slice(9).split("").reverse();

		const newFramesRearranged = [];
		for (let i = 0; i < newFrames.length; i++) {
			const newFrame = parseInt(newFrames[i]);
			if (newFrame === 1) {
				newFramesRearranged.push(i);
			}
		}

		const oldFramesRearranged = [];
		for (let i = 0; i < oldFrames.length; i++) {
			const oldFrame = parseInt(oldFrames[i]);
			if (oldFrame === 1) {
				oldFramesRearranged.push(i);
			}
		}

		const otherOldFrames = newFramesRearranged.filter((el) => !oldFramesRearranged.includes(el));

		// Delete the burned token images
		await this.removeGifs(set, oldFramesRearranged);
		await this.removeGifs(set, otherOldFrames);
	}

	async removeGifs(set, frames) {
		try {
			const key = `generated-gifs/${set}_${frames}.gif`;
			await this.s3.delete(key);
			console.log(`Deleted ${key}`);
		} catch (e) {
			console.error("Delete old gifs error", e);
		}
	}
}

export const handler = async (event) => {
	const { tokenId } = event;

	const imageGeneration = new ImageGeneration();
	console.log("Connecting client");
	await imageGeneration.cache.init();
	console.log("Connected client");
	const result = await imageGeneration.getImageRoute(tokenId);
	console.log("Quitting client");
	await imageGeneration.cache.flush();
	console.log("Quit client");
	const response = {
		statusCode: result.error ? 400 : 200,
		body: JSON.stringify(result),
	};
	return response;
};

// console.log(await handler({ tokenId: 105 }));
