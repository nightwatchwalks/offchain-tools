import * as dotenv from "dotenv";
import AWS from "aws-sdk";

async function main() {
	// Load environment variables
	dotenv.config();

	// Initialize lambda
	const lambda = new AWS.Lambda({
		accessKeyId: process.env.AWS_ACCESS_KEY_ID_,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_,
		region: "us-east-1",
	});

	const generateTokenImage = async (tokenId) => {
		console.log("Generating gif for token", tokenId);

		// Initialize params
		const params = {
			FunctionName: "night-watch-generate-image",
			Payload: JSON.stringify({ tokenId: tokenId.toString() }),
		};

		// Generate image
		const lambdaRes = await lambda.invoke(params).promise();
		const lambdaPayload = JSON.parse(lambdaRes.Payload);
		if (lambdaPayload.statusCode !== 200) {
			console.error(lambdaRes);
			throw new Error("LambdaError");
		}

		const lambdaBody = JSON.parse(lambdaPayload.body);
		if (lambdaBody.image) {
			console.log(`Image generated for token with id `, tokenId, ". Link: ", lambdaBody.image);
			return true;
		} else {
			console.error("Error generating image for token with id ", tokenId, ". Error: ", lambdaBody.error);
			return false;
		}
	};

	// Generate token images
	const simultaneousGeneration = 500;

	for (let tokenId = 0; tokenId < 6825; tokenId += simultaneousGeneration) {
		// Generate token images simultaneously
		const promises = [];
		for (let i = 0; i < simultaneousGeneration; i++) {
			if (tokenId + i < totalSupply) {
				promises.push(generateTokenImage(tokenId + i));
			}
		}

		// Wait for all promises to resolve
		await Promise.all(promises);
	}

	// Close cache
	await cache.flush();
}

main();
