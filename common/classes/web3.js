import ethers from "ethers";
import * as dotenv from "dotenv";
import got from "got";

export default class Web3 {
	provider;
	contract;
	cache;

	constructor(cache) {
		if (!cache) {
			throw new Error("Cache is required");
		}

		// Load environment variables
		dotenv.config();

		const customNodeUrl = process.env.CUSTOM_NODE_URL;
		this.cache = cache;
		this.network = process.env.NETWORK;
		if (!this.network) throw new Error("NETWORK is required");

		if (customNodeUrl) {
			this.provider = new ethers.providers.JsonRpcProvider(customNodeUrl, this.network);
		} else {
			throw new Error("CUSTOM_NODE_URL is required");
		}

		this.shouldCheckTokenExist = process.env.CHECK_IS_TOKEN_EXISTS === "true";
	}

	async fetchAbiAndCreateContract() {
		if (!process.env.ABI_URL) throw new Error("ABI url not set in .env file");
		const abi = JSON.parse((await got(process.env.ABI_URL)).body);
		const contractAddress = process.env.CONTRACT_ADDRESS;
		if (!contractAddress) throw new Error("Contract address not set in .env file");
		this.contract = new ethers.Contract(contractAddress, abi, this.provider);
	}

	async getSet(tokenId) {
		if (!this.contract) {
			await this.fetchAbiAndCreateContract();
		}

		// Get the set from the cache if exists
		const cacheVal = await this.cache.get("set_" + tokenId);
		if (cacheVal) {
			return Number(cacheVal);
		}

		// Get set from the contract
		const set = await this.contract.getSet(tokenId);

		// Set the cache and return the set
		await this.cache.set("set_" + tokenId, set);
		return set;
	}

	async getFrames(tokenId) {
		if (!this.contract) {
			await this.fetchAbiAndCreateContract();
		}

		// Get the frames from the cache if exists
		const cacheVal = await this.cache.get("frames_" + tokenId);
		if (cacheVal) {
			return JSON.parse(cacheVal);
		}

		// Get frames from the contract
		const framesResp = await this.contract.getFrames(tokenId);

		const frames = [];

		// Loop through the result and push the existing frames to the array
		for (let i = 0; i < framesResp.length; i++) {
			const frame = framesResp[i];
			if (frame.toNumber() !== 0) frames.push(i);
		}

		// Set the cache and return the frames
		await this.cache.set("frames_" + tokenId, JSON.stringify(frames));

		return frames;
	}

	async isTokenExists(tokenId) {
		if (!this.shouldCheckTokenExist) return true;

		if (!this.contract) {
			await this.fetchAbiAndCreateContract();
		}

		// Get the next token id from the cache
		let nextTokenId = await this.cache.get("nextTokenId");

		// If the next token id is not cached
		if (!nextTokenId) {
			// Get the next token id from the contract
			nextTokenId = (await this.contract.getNextToken()).toNumber();

			// Cache the next token id for 10 seconds
			await this.cache.set("nextTokenId", nextTokenId, 10);
		} else {
			nextTokenId = Number(nextTokenId);
		}

		// Check if the token exists
		const isTokenExists = nextTokenId > tokenId;

		return isTokenExists;
	}
}
