import redis from "redis";
import * as dotenv from "dotenv";

export default class Cache {
	constructor() {
		dotenv.config();
		this.redisEndpoint = process.env.REDIS_ENDPOINT;
		if (!this.redisEndpoint) throw new Error("Redis endpoint not set in .env file");

		this.defaultCacheTime = process.env.DEFAULT_CACHE_TIME;
		if (!this.defaultCacheTime) throw new Error("Default cache time not set in .env file");

		this.client = redis.createClient({
			url: this.redisEndpoint,
		});
	}

	async init() {
		await this.client.connect();
	}

	async get(key) {
		return await this.client.get(key);
	}

	async set(key, value, expirationTimeInSeconds = this.defaultCacheTime) {
		return await this.client.set(key, value, {
			EX: expirationTimeInSeconds,
		});
	}

	async flush() {
		return await this.client.quit();
	}
}
