const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (_amount) => ethers.utils.parseEther(_amount.toString());
const fromWei = (_amount) =>
	parseFloat(ethers.utils.formatEther(_amount.toString()));

describe("ZooprPass", () => {
	let deployer, user1, user2, user3;
	const tokenURI = "ZooprPass tokenURI";
	let fees;

	beforeEach(async () => {
		[deployer, user1, user2, user3] = await ethers.getSigners();
		const ZooprPass = await ethers.getContractFactory("ZooprPass");
		this.contract = await ZooprPass.connect(deployer).deploy(tokenURI);
		fees = await this.contract.fees();
	});

	describe("deployment", () => {
		it("should deploy contract properly", async () => {
			expect(this.contract.address).to.not.be.undefined;
			expect(this.contract.address).to.not.null;
		});

		it("should set name properly", async () => {
			expect(await this.contract.name()).to.equal("ZooprPass");
		});

		it("should set symbol properly", async () => {
			expect(await this.contract.symbol()).to.equal("ZPASS");
		});

		it("should have correct totalCap", async () => {
			expect(parseInt(await this.contract.totalCap())).to.equal(1000);
		});

		it("should set initial stage properly", async () => {
			expect(await this.contract.stage()).to.equal("SEED");
			expect(fromWei(await this.contract.fees())).to.equal(1);
		});
	});

	describe("updateStageDetail", () => {
		const _stage = "TEST";
		const _stageCap = 900;
		const _fees = 0.05;

		it("should update the stage details", async () => {
			await this.contract
				.connect(deployer)
				.updateStageDetail(_stage, _stageCap, toWei(_fees));

			expect(await this.contract.stage()).to.equal(_stage);
			expect(parseInt(await this.contract.stageCap())).to.equal(_stageCap);
			expect(fromWei(await this.contract.fees())).to.equal(_fees);
		});

		it("should reject if caller is not owner", async () => {
			await expect(
				this.contract
					.connect(user1)
					.updateStageDetail(_stage, _stageCap, toWei(_fees))
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should reject if stageCap exceeds totalCap", async () => {
			await expect(
				this.contract
					.connect(deployer)
					.updateStageDetail(_stage, 10_000, toWei(_fees))
			).to.be.revertedWith("ZooprPass: StageCap exceeds totalCap");
		});
	});

	describe("mint", () => {
		it("should mint token properly", async () => {
			await this.contract.connect(user1).mint({ value: fees });
			expect(await this.contract.ownerOf("0")).to.equal(user1.address);
		});

		it("should transfer mint fee to owner", async () => {
			await expect(
				await this.contract.connect(user1).mint({ value: fees })
			).to.changeEtherBalances(
				[deployer, user1],
				[fees, toWei(-1 * fromWei(fees))]
			);
		});

		it("should refund excess mint fee to caller", async () => {
			await expect(
				await this.contract
					.connect(user1)
					.mint({ value: toWei(fromWei(fees) * 2) })
			).to.changeEtherBalances(
				[deployer, user1],
				[fees, toWei(-1 * fromWei(fees))]
			);
		});

		it("should set tokenURI properly", async () => {
			await this.contract.connect(user1).mint({ value: fees });
			expect(await this.contract.tokenURI("0")).to.equal(tokenURI);
		});

		it("should reject low mint fee", async () => {
			await expect(
				this.contract.connect(user1).mint({ value: toWei(0.000001) })
			).to.be.revertedWith("ZooprPass: insufficient mint fees");
		});

		it("should reject if stageCap has been met", async () => {
			await this.contract.updateStageDetail("TEST", 4, fees);

			for (let i = 1; i <= 2; ++i) {
				await this.contract.connect(user2).mint({ value: fees });
				await this.contract.connect(user3).mint({ value: fees });
			}

			await expect(
				this.contract.connect(user1).mint({ value: fees })
			).to.be.revertedWith("ZooprPass: stageCap exceeded");
		});

		it("should reject if max mint has been met", async () => {
			for (let i = 1; i <= 2; ++i)
				await this.contract.connect(user1).mint({ value: fees });

			await expect(
				this.contract.connect(user1).mint({ value: fees })
			).to.be.revertedWith("ZooprPass: max mint exceeded");
		});

		// it("should reject if totalCap is exceeded", async () => {
		// 	for (let i = 1; i <= 1000; i++)
		// 		await this.contract.connect(user1).mint({ value: fees });

		// 	await expect(
		// 		this.contract.connect(user1).mint({ value: fees })
		// 	).to.be.revertedWith("ZooprPass: totalCap exceeded");
		// });
	});
});
