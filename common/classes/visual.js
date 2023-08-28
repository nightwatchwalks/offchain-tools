import got from "got";
import { GIF } from "imagescript";
import * as dotenv from "dotenv";

export default class Visual {
	mainGifsUrl;
	generatedGifsUrl;
	mappings;

	constructor() {
		// Load environment variables
		dotenv.config();

		this.mainGifsUrl = process.env.MAIN_GIFS_URL;
		this.generatedGifsUrl = process.env.GENERATED_GIFS_URL;

		if (!this.mainGifsUrl) throw new Error("Main gifs url not set in .env file");
		if (!this.generatedGifsUrl) throw new Error("Generated gifs url not set in .env file");
	}

	async fetchMappings() {
		// Fetch mappings.json file from url using got
		if (!process.env.MAPPINGS_JSON_URL) throw new Error("Mappings json url not set in .env file");
		this.mappings = new Map(JSON.parse((await got(process.env.MAPPINGS_JSON_URL)).body));
	}

	// Generate the gif with the provided set and frames
	async generateGif(set, frames) {
		const gif = await this.getMainGif(set);

		// Return the first frame if there is only 1 frame in the token
		if (frames.length === 1) {
			const img = await gif[frames[0]].encode(1);
			return Buffer.from(img.buffer);
		}

		// Fill in the missing frames in the token with the previous existing frame
		let lastNumber = frames[0];
		for (let i = 0; i < 15; i++) {
			if (!frames.includes(i)) {
				gif[i] = gif[lastNumber];
			} else {
				lastNumber = i;
			}
		}

		// Render and return the gif
		const render = await gif.encode(100);
		return Buffer.from(render.buffer);
	}

	async getMainGif(set) {
		if (!this.mappings) {
			await this.fetchMappings();
		}

		// Get the gif name of the set
		const gifName = this.mappings.get(set);
		// Get the file from S3
		const gifFile = await got(`${this.mainGifsUrl}/${gifName}`).buffer();
		// Decode as GIF object and return
		return await GIF.decode(gifFile);
	}
}
