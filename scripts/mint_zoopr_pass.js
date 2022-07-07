const hre = require("hardhat");
require("dotenv/config");
const { ZooprPassAddress } = process.env;

async function main() {
	try {
		this.zooprPass = await hre.ethers.getContractAt(
			"ZooprPass",
			ZooprPassAddress
		);
		console.log("Minting Genesis Pass...");
		await this.zooprPass.mint({
			gasPrice: "20000000000",
			value: (10 ** 18).toString(),
		});
		console.log("Access token minted!");
	} catch (error) {
		console.log(error);
		return error;
	}
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
