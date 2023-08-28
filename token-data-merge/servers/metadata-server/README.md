# metadata-server
An express.js server to provide token metadata and token images to the marketplaces and to the users

## Usage
- Run `yarn install` in both root and the tool directories.
- Create an `.env` file and fill it using the `.env.example` file.
- Run `yarn start` command to run the server

## Endpoints
### `/get/:tokenId`
- Returns the metadata of the token
### `/getImage/:tokenId`
- Returns the image of the token
