# generate-all-token-images
A helper tool to generate all the token images for faster reveal

## Usage
- Run `yarn install` in both root and the tool directories.
- Create an `.env` file and fill it using the `.env.example` file.
- By default generation will be handled with batches of 10 tokens. If you want to increase this number, change `simultaneousGeneration` variable in the `index.js` file.
- Use `yarn start` in the tool directory
