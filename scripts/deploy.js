const hre = require("hardhat");
require("dotenv/config");

async function main() {
	const _zooprPassTokenURI =
		"https://bafyreig57eyhpv3bz42aauid7iuv3knrz6v4wnx43rehu74zo7rraekrye.ipfs.dweb.link/metadata.json";

	const ZooprPass = await ethers.getContractFactory("ZooprPass");
	const UniqueNameToken = await hre.ethers.getContractFactory(
		"UniqueNameToken"
	);

	this.zooprPass = await ZooprPass.deploy(_zooprPassTokenURI);
	await this.zooprPass.deployed();

	this.uniqueNameToken = await UniqueNameToken.deploy(this.zooprPass.address);
	await this.uniqueNameToken.deployed();

	console.log("ZooprPass deployed to:", this.zooprPass.address);
	console.log("UniqueNameToken deployed to:", this.uniqueNameToken.address);

	console.log("Adding new validator");
	await this.uniqueNameToken.grantRole(
		await this.uniqueNameToken.VALIDATOR_ROLE(),
		process.env.VALIDATOR_ADDRESS
	);
	console.log(`Successfully added ${process.env.VALIDATOR_ADDRESS}...`);

	console.log("Updating UNT minting fee...");
	await this.uniqueNameToken.updateStageDetail("SEED", 1000, 0.001 * 10 ** 18);
	console.log("Minting fee updated successfully...");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
