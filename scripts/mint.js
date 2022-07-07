const hre = require("hardhat");
const axios = require("axios");
require("dotenv/config");
const { UniqueNameTokenAddress } = process.env;

async function main() {
	try {
		// const BASE_URL = "https://zoopr-backend.herokuapp.com/api";
		const BASE_URL = "http://localhost:8080/api";

		const { data, fees } = await (
			await axios.get(
				`${BASE_URL}/unts/getMintingData?account=${process.env.DEPLOYER_ADDRESS}&username=binance`
			)
		).data;

		this.uniqueNameToken = await hre.ethers.getContractAt(
			"UniqueNameToken",
			UniqueNameTokenAddress
		);
		console.log("Minting UNT...");
		await this.uniqueNameToken.mint(data, {
			gasPrice: "5000000000",
			value: fees,
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
