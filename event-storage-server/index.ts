import * as dotenv from "dotenv";
import { Hash, createPublicClient, fallback, http, webSocket, parseAbiItem, Block } from "viem";
import { goerli, mainnet } from "viem/chains";
import * as redis from "redis";
import fs from "fs";

dotenv.config();
const nightWatchContract = getEnv("NIGHT_WATCH_CONTRACT") as Hash;
const nightWatchVendorContract = getEnv("NIGHT_WATCH_VENDOR_CONTRACT") as Hash;
const contractDeploymentBlock = Number(getEnv("CONTRACT_DEPLOYMENT_BLOCK"));
const redisEndpoint = getEnv("REDIS_ENDPOINT");
const ethClient = getClient(false);
const redisClient = redis.createClient({
	url: redisEndpoint,
});

process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);
process.on("exit", cleanupAndExit);

(BigInt.prototype as any).toJSON = function () {
	return this.toString();
};
let updateEventsRunning = false;
let plannedUpdateEventsInterval: NodeJS.Timeout;
init();

async function init() {
	try {
		await initRedis();

		// Fetch all events from the contract deployment block to the current last block from Ethereum
		await updateEvents(true);

		// Watch for new events
		ethClient.watchEvent({
			address: nightWatchContract,
			event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
			onLogs: async () => await updateEvents(),
		});

		ethClient.watchEvent({
			address: nightWatchVendorContract,
			event: parseAbiItem("event Purchase(address indexed receiver, uint256 amount)"),
			onLogs: async () => await updateEvents(),
		});

		// Regular integrity checks
		ethClient.watchBlocks({
			onBlock: async (block) => {
				if (Number(block.number) % 900 === 0) {
					await updateEvents(true);
					console.log("Refetched all events for tri-hourly integrity check.");
				}
			},
		});
	} catch (e) {
		console.error("Error in init:", e);
		throw e;
	}
}

async function initRedis() {
	try {
		await redisClient.connect();
		console.log("Connected to Redis successfully.");
	} catch (error) {
		console.error("Failed to connect to Redis:", error.message);

		process.exit(1);
	}
}

async function updateEvents(fromStart: boolean = false) {
	try {
		if (updateEventsRunning) {
			console.log("Update events is already running");
			if (!plannedUpdateEventsInterval) {
				plannedUpdateEventsInterval = setInterval(async () => {
					if (!updateEventsRunning) {
						clearInterval(plannedUpdateEventsInterval);
						plannedUpdateEventsInterval = undefined;
						await updateEvents(fromStart);
					}
				}, 1000);
			}
			return;
		}
		updateEventsRunning = true;

		// Get current last block from Ethereum
		const latestBlock = Number(await ethClient.getBlockNumber());
		console.log("Latest Ethereum block", latestBlock);

		// Get current last block fetched from Redis
		let latestBlockFetched: number;
		if (fromStart) {
			latestBlockFetched = contractDeploymentBlock;
		} else {
			latestBlockFetched = Number(await redisClient.get("eventStorage_latestBlockFetched"));
			console.log("Latest block fetched", latestBlockFetched);
			if (latestBlockFetched == null || latestBlockFetched == 0) {
				latestBlockFetched = contractDeploymentBlock;
			}
		}

		// If current last block fetched is less than current last block from Ethereum
		// Fetch events from current last block fetched to current last block from Ethereum
		if (latestBlockFetched < latestBlock) {
			const newTransferEvents = await fetchTransferEvents(latestBlockFetched);
			const newPurchaseEvents = await fetchPurchaseEvents(latestBlockFetched);
			const newClaimEvents = await fetchClaimEvents(latestBlockFetched);

			let events = {
				transferEvents: [],
				purchaseEvents: [],
				claimEvents: [],
			};

			if (!fromStart) {
				events = JSON.parse(
					(await redisClient.get("eventStorage_events")) || "{transferEvents: [], purchaseEvents: [], claimEvents: []}"
				);
			}

			if (newTransferEvents.length > 0) {
				events.transferEvents.push(...newTransferEvents);
			}

			if (newPurchaseEvents.length > 0) {
				events.purchaseEvents.push(...newPurchaseEvents);
			}

			if (newClaimEvents.length > 0) {
				events.claimEvents.push(...newClaimEvents);
			}

			const duplicateFilter: (value: any, index: number, array: any[]) => unknown = (event, index, self) =>
				index === self.findIndex((e) => e.transactionHash === event.transactionHash && e.logIndex === event.logIndex);

			events.transferEvents = events.transferEvents.filter(duplicateFilter);
			events.purchaseEvents = events.purchaseEvents.filter(duplicateFilter);
			events.claimEvents = events.claimEvents.filter(duplicateFilter);

			const transactionSorter: (a: any, b: any) => number = (a, b) => {
				if (a.blockNumber === b.blockNumber) {
					return Number(a.transactionIndex) - Number(b.transactionIndex);
				}
				return Number(a.blockNumber) - Number(b.blockNumber);
			};

			events.transferEvents.sort(transactionSorter);
			events.purchaseEvents.sort(transactionSorter);
			events.claimEvents.sort(transactionSorter);

			let tries = 0;
			while (tries < 5) {
				try {
					tries++;

					// Add new events to Redis
					const serializedEvents = JSON.stringify(events);
					await redisClient
						.multi()
						.set("eventStorage_events", serializedEvents)
						.set("eventStorage_latestBlockFetched", latestBlock.toString())
						.exec();
				} catch (e) {
					console.error(
						"An error occured while updating events",
						e,
						"\n",
						tries === 5 ? "Max tries have been reached. Exiting." : "Retrying to update events in 5 seconds..."
					);

					if (tries === 5) {
						process.exit(1);
					}
					await delay(500);
				}

				break;
			}

			console.log("Events have been updated.");

			// Create data folder if not exist
			if (!fs.existsSync("./data")) {
				fs.mkdirSync("./data");
			}

			fs.writeFileSync("./data/events.json", await redisClient.get("eventStorage_events"));
			console.log("Events saved to file.");
		} else {
			console.log("No new events to fetch");
		}
	} catch (e) {
		console.error("Error in updateEvents:", e);
		throw e;
	} finally {
		updateEventsRunning = false;
	}
}

async function fetchTransferEvents(fromBlock: number) {
	try {
		return await fetchEvents(
			nightWatchContract,
			"event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
			fromBlock
		);
	} catch (e) {
		console.error("Error fetching transfer events:", e);
		throw e;
	}
}

async function fetchPurchaseEvents(fromBlock: number) {
	try {
		return await fetchEvents(nightWatchVendorContract, "event Purchase(address indexed receiver, uint256 amount)", fromBlock);
	} catch (e) {
		console.error("Error fetching purchase events:", e);
		throw e;
	}
}

async function fetchClaimEvents(fromBlock: number) {
	try {
		return await fetchEvents(nightWatchVendorContract, "event Claim(address indexed receiver, uint16[] tokens)", fromBlock);
	} catch (e) {
		console.error("Error fetching claim events:", e);
		throw e;
	}
}

async function fetchEvents(address: Hash, abiItem: string, fromBlock: number = contractDeploymentBlock) {
	try {
		const CHUNK_SIZE = BigInt(10000);
		let logs;
		let currentBlock = BigInt(fromBlock);

		// Get latest block number
		const latestBlock = BigInt(await ethClient.getBlockNumber());

		while (currentBlock <= latestBlock) {
			console.log("Fetching logs from block", currentBlock);
			const toBlock = currentBlock + CHUNK_SIZE <= latestBlock ? currentBlock + CHUNK_SIZE : latestBlock;

			const chunkLogs = await ethClient.getLogs({
				address: address,
				// @ts-ignore
				event: parseAbiItem(abiItem),
				fromBlock: currentBlock,
				toBlock: toBlock,
			});

			if (!logs) {
				logs = chunkLogs;
			} else {
				logs.push(...chunkLogs);
			}

			currentBlock = toBlock + BigInt(1);
		}

		return logs.map((log: any) => {
			return {
				blockNumber: log.blockNumber,
				args: log.args,
				transactionHash: log.transactionHash,
				transactionIndex: log.transactionIndex,
				logIndex: log.logIndex,
			};
		});
	} catch (e) {
		console.error("Error in fetchEvents:", e);
		throw e;
	}
}

function getClient(withWebsocket = true) {
	const alchemyWebsocket = webSocket(getEnv("ALCHEMY_WEBSOCKET_URL"));
	const alchemy = http(getEnv("ALCHEMY_URL"));
	const infuraWebsocket = webSocket(getEnv("INFURA_WEBSOCKET_URL"));
	const infura = http(getEnv("INFURA_URL"));
	const customRpcUrl = http(getEnv("CUSTOM_NODE_URL"));

	const transportsWithWebsocket = [alchemyWebsocket, infuraWebsocket, alchemy, infura, customRpcUrl];
	const transportsWithoutWebsocket = [alchemy, infura, customRpcUrl];

	return createPublicClient({
		chain: getChain(),
		transport: fallback(withWebsocket ? transportsWithWebsocket : transportsWithoutWebsocket),
	});
}

function getChain() {
	const anvilLocalhost = {
		id: 31337,
		name: "Localhost",
		network: "localhost",
		nativeCurrency: {
			decimals: 18,
			name: "Ether",
			symbol: "ETH",
		},
		rpcUrls: {
			default: {
				http: ["http://127.0.0.1:8545"],
			},
			public: {
				http: ["http://127.0.0.1:8545"],
			},
		},
	} as const;

	const chainId: number = Number(getEnv("CHAIN_ID"));

	return chainId === 31337 ? anvilLocalhost : chainId === 5 ? goerli : mainnet;
}

async function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cleanupAndExit() {
	console.log("Received shutdown signal. Cleaning up...");
	try {
		await redisClient.quit();
		console.log("Redis client disconnected.");
		process.exit(0);
	} catch (e) {
		console.error("Error while cleaning up:", e);
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
