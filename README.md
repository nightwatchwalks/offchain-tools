# Night Watch Off-Chain Tools
This repository contains all the off-chain tools to create, run and maintain Night Watch project.

## Tools
### Image Generation Tools
| Tool | Description |
| ------ | ------ |
| compress-gifs | A helper tool to compress all the main gifs of the project. |
| generate-all-token-images | A helper tool to generate all the token images for faster reveal |
| generate-token-image | AWS Lambda function to generate token images on demand |

### Token Data & Merge Tools
| Tool | Description |
| ------ | ------ |
| find-mergeable-tokens | Find mergeable tokens to merge during the reveal. |
| random-gif-id-mapping | Assign seeded random unique id's to all the gifs to use with token data |
| token-data-generator | Assign seeded random sets and frames to all the tokens to use during reveal |
| token-data-to-uint24 | A helper tool to convert set and frame data to uint24. Helpful for smart contract testing. |

#### Servers
| Tool | Description |
| ------ | ------ |
| metadata-server | An express.js server to listen to token metadata and image requests. Also responsible for sending generate token image requests to AWS Lambda if the token image does not exist |
| event-storage-server | A server to store transfer, claim, purchase events for a faster sale-website |

## Installation
Run `yarn install` in the root directory to install common packages needed for all tools. Also, run the command in the directories of the tools you want to use.

## Usage
Check README.md for each tool you want to use

## License

[MIT](LICENSE) © 2023 Night Watch

(License is for the software. Visual artworks aren't included.)