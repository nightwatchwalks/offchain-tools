/*
 * USAGE: yarn tokenDataToUint24 <set> <frames, comma separated>
 */

const convertTokenDataToUint24 = (set, frames) => {
	if (set <= 0 || set > 455) throw new Error("Set must be between 1 and 455 (inclusive).");
	for (const frame of frames) {
		if (frame < 0 || frame > 14) throw new Error("Frame must be between 0 and 14 (inclusive).");
	}

	// Convert set into binary number
	const setBinary = set.toString(2).padStart(9, "0");

	// Initialize frame binary array
	let frameBinary = "000000000000000";

	// Change (14 - frame)th character to 1 to add the frame into binary array
	for (let frame of frames) {
		frame = parseInt(frame);
		frameBinary = `${frameBinary.substr(0, 14 - frame)}1${frameBinary.substr(14 - frame + 1)}`;
	}

	// Combine the set and frame binary numbers
	const binary = setBinary + frameBinary;

	console.log(binary);

	// Convert the binary number to a uint24
	const uint24 = parseInt(binary, 2);

	return uint24;
};

const set = parseInt(process.argv[2]);
const frames = process.argv[3].split(",");

console.log(convertTokenDataToUint24(set, frames));
