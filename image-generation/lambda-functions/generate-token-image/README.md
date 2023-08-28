# generate-token-image
AWS Lambda function to generate token images

## Usage
- Run `yarn install` in both root and the tool directories.
- Upload the function to AWS Lambda
- Fill the environment variables using the `.env.example` file
- Send requests with `tokenId` in the body.

## Local Usage
- Run `yarn install` in both root and the tool directories.
- Create an `.env` file and fill it using the `.env.example` file.
- Uncomment the last line in the `index.js` file and change the token id with the one you want to generate
- Run `node index` command
