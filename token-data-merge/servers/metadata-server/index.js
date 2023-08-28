import * as dotenv from "dotenv";
import express from "express";
import got from "got";
import rateLimit from "express-rate-limit";

import Web3 from "../../../common/classes/web3.js";
import Cache from "../../../common/classes/cache.js";
import AWS from "aws-sdk";

class MetadataServer {
	web3;
	cache;
	mappings;
	shouldRateLimit;
	lambda;

	constructor() {
		// Load environment variables
		dotenv.config();

		// Initialize classes
		this.cache = new Cache();
		this.web3 = new Web3(this.cache);
		this.shouldRateLimit = process.env.RATE_LIMIT === "true";

		this.lambda = new AWS.Lambda({
			accessKeyId: process.env.AWS_ACCESS_KEY_ID_,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_,
			region: "us-east-1",
		});
	}

	async fetchMappings() {
		// Fetch mappings.json file from url using got
		this.mappings = new Map(JSON.parse((await got(process.env.MAPPINGS_JSON_URL)).body));
	}

	async getTokenRoute(req, res) {
		try {
			const { tokenId } = req.params;
			console.log(`Get request listened. Token id: ${tokenId}`);

			if (!tokenId || Number.isNaN(tokenId)) return res.status(400).json({ error: "Invalid token id" });

			if (!(await this.web3.isTokenExists(tokenId))) return res.status(400).json({ error: "Invalid token id" });

			// Get set and frames
			let set = 0;
			let frames = [];
			let imageUrl;

			set = await this.web3.getSet(tokenId);
			frames = await this.web3.getFrames(tokenId);
			imageUrl = await this.getImageUrl(set, frames);
			if (imageUrl === null) imageUrl = `https://${req.headers.host}/getImage/${tokenId}`;

			// Get image url and token metadata
			const metadata = await this.getTokenMetadata(tokenId, set, frames, imageUrl);

			// Send metadata as response
			console.log(`Metadata for ${tokenId} sent.`);
			res.json(metadata);
		} catch (e) {
			if (process.env.NODE_ENV === "development") {
				console.error(e);
				res.status(400).json({ error: e.message });
			} else {
				console.error("Token route error happened. Token id:", req.params.tokenId);
				res.status(400).json({ error: "An error occured during request! Please contact admins." });
			}
		}
	}

	async getImageRoute(req, res) {
		try {
			const { tokenId } = req.params;
			console.log(`Get image request listened. Token id: ${tokenId}`);

			if (!tokenId || Number.isNaN(tokenId)) return res.status(400).json({ error: "Invalid token id" });

			if (!(await this.web3.isTokenExists(tokenId))) return res.status(400).json({ error: "Invalid token id" });

			// Get set and frames
			const set = await this.web3.getSet(tokenId);
			const frames = await this.web3.getFrames(tokenId);

			// Get image url and token metadata
			let imageUrl = await this.getImageUrl(set, frames);

			if (imageUrl !== null) {
				res.set("Content-Type", "image/gif");
				res.set("Content-Disposition", "inline");
				return res.redirect(imageUrl);
			}

			// Generate image
			if (this.cache.get("generating_" + tokenId) === "true") {
				res.set("Retry-After", "10");
				return res.status(503).json({ error: "Image is generating. Please try again in later." });
			}

			let lambdaPayload;
			let tries = 0;
			do {
				try {
					lambdaPayload = await this.invokeLambdaFunction(tokenId);
					tries++;
				} catch (e) {
					if (e.statusCode === 429) {
						console.log("Lambda function is busy. Waiting 250ms and trying again.");
						await this.delay(250);
					} else {
						throw e;
					}
				}
			} while (!lambdaPayload && tries < 5);

			const lambdaBody = JSON.parse(lambdaPayload.body);
			res.set("Content-Type", "image/gif");
			res.set("Content-Disposition", "inline");
			return res.redirect(lambdaBody.image);
		} catch (e) {
			if (process.env.NODE_ENV === "development") {
				console.error(e);
				res.status(500).json({ error: e.toString() });
			} else {
				console.error("Image route error happened. Token id:", req.params.tokenId);
				res.status(500).json({ error: "An error occured during request! Please contact admins." });
			}
		}
	}

	async invokeLambdaFunction(tokenId) {
		const params = {
			FunctionName: "night-watch-generate-image",
			Payload: JSON.stringify({ tokenId: tokenId }),
		};

		const lambdaRes = await this.lambda.invoke(params).promise();
		const lambdaPayload = JSON.parse(lambdaRes.Payload);
		if (lambdaPayload.statusCode === 429) {
			throw lambdaPayload;
		}

		if (lambdaPayload.statusCode !== 200) {
			throw new Error("LambdaError", lambdaRes);
		}
		return lambdaPayload;
	}

	async delay(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async getTokenMetadata(tokenId, set, frames, imageUrl) {
		// Create attributes object
		const attributes = [];

		if (frames.length === 0 || set === 0) {
			return {
				name: "Night Watch #" + tokenId,
				image: imageUrl,
				description: "There is nothing to see here. This is a thing of the past. Go find a living Night Watch!",
				attributes: [
					{
						trait_type: "Merged Frame Count",
						value: "0",
					},
				],
			};
		}

		// Add set id to the attributes object
		attributes.push({
			trait_type: "Trio Id",
			value: set.toString(),
		});

		// Add collected frame count to the attributes object
		attributes.push({
			trait_type: "Merged Frame Count",
			value: frames.length.toString(),
		});

		// Add frames to the attributes object
		for (const frame of frames) {
			attributes.push({
				trait_type: "Frame",
				value: (frame + 1).toString(),
			});
		}

		if (!this.mappings) {
			await this.fetchMappings();
		}

		// Get gif name from the set mappings
		const gifName = this.mappings.get(set);
		// Get animal names from the gif name
		const animals = gifName.replace(".gif", "").split("-");

		// Add animals to the attributes object
		for (const animal of animals) {
			attributes.push({
				trait_type: "Animal",
				value: animal,
			});
		}

		let direction = "Forward";

		const reversedOnes = [
			"Caretta-Tortoise-Penguin",
			"Caretta-Unicorn-Dolphin",
			"Dolphin-Unicorn-Seahorse",
			"Elephant-Dolphin-Rhino",
			"Gorilla-Unicorn-Seal",
			"Gorilla-Whale-Lion",
			"Lemur-Gorilla-Dolphin",
			"Lion-Dolphin-Rhino",
			"Lion-Seahorse-Caretta",
			"Lion-Seal-Lemur",
			"Seahorse-Penguin-Panda",
			"Seal-Lemur-Seahorse",
			"Seal-Rhino-Whale",
			"Tortoise-Whale-Panda",
			"Whale-Rhino-Giraffe",
		];

		if (reversedOnes.includes(gifName.replace(".gif", ""))) direction = "Reverse";

		attributes.push({
			trait_type: "Direction",
			value: direction,
		});

		// Create and return the metadata object
		return {
			name: "Night Watch #" + tokenId,
			image: imageUrl,
			description: "A story of a " + animals[0] + " and a " + animals[1] + " and a " + animals[2] + " strolling around in the night.",
			attributes: attributes,
		};
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
				console.log("Image exist! Returning the image.");
				return url;
			}
		} catch {}

		return null;
	}

	async rootRoute(req, res) {
		return res.send("Night Watch");
	}

	async runServer() {
		const cache = this.cache;
		await cache.init();
		const server = express();
		server.get("/", this.rootRoute.bind(this));
		server.get("/get/:tokenId", this.getTokenRoute.bind(this));
		server.get("/getImage/:tokenId", this.getImageRoute.bind(this));
		const port = process.env.METADATA_SERVER_PORT || 3000;

		if (this.shouldRateLimit) {
			const limiter = rateLimit({
				windowMs: 30 * 1000, // 30 seconds
				max: 10, // Limit each IP to 10 requests per `window` (here, per 30 seconds)
				standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
				legacyHeaders: false, // Disable the `X-RateLimit-*` headers
			});

			// Apply the rate limiting middleware to all requests
			server.use(limiter);
		}

		// Flush the cache on exit
		process.on("exit", async function () {
			await cache.flush();
		});

		server.listen(port, () => console.log("Metadata server started. Port: " + port));
	}
}

const metadataServer = new MetadataServer();
await metadataServer.runServer();
