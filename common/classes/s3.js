import AWS from "aws-sdk";
import * as dotenv from "dotenv";

export default class S3 {
	s3Instance;
	bucketName;

	constructor() {
		// Load environment variables
		dotenv.config();

		const accessKeyId = process.env.AWS_ACCESS_KEY_ID_;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_;
		this.bucketName = process.env.AWS_BUCKET_NAME;

		if (!accessKeyId) throw new Error("AWS access key ID not set in .env file");
		if (!secretAccessKey) throw new Error("AWS secret access key not set in .env file");
		if (!this.bucketName) throw new Error("AWS bucket name not set in .env file");

		this.s3Instance = new AWS.S3({
			accessKeyId: accessKeyId,
			secretAccessKey: secretAccessKey,
		});
	}

	async upload(key, body) {
		return await this.s3Instance
			.upload({
				Bucket: this.bucketName,
				Key: key,
				Body: body,
				ContentDisposition: "inline",
				ContentType: "image/gif",
			})
			.promise();
	}

	async delete(key) {
		return await this.s3Instance
			.deleteObject({
				Bucket: this.bucketName,
				Key: key,
			})
			.promise();
	}

	async getObjectsFromPrefix(prefix) {
		return await this.s3Instance.listObjects({ Bucket: this.bucketName, Prefix: prefix, MaxKeys: 1000 }).promise();
	}
}
