import * as redis from "redis";
import * as dotenv from "dotenv";

dotenv.config();
const redisEndpoint = getEnv("REDIS_ENDPOINT");
const redisClient = redis.createClient({
	url: redisEndpoint,
});

clearRedis();
async function clearRedis() {
	try {
		await redisClient.connect();
		console.log("Connected to Redis successfully.");

		await redisClient.flushAll();
		console.log("Cleared Redis successfully.");

		await redisClient.quit();
	} catch (error) {
		console.error("Failed to connect to Redis:", error.message);

		process.exit(1);
	}
}

function getEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Environment variable ${key} not set.`);
	}
	return value;
}
