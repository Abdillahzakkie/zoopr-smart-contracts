const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (_amount) => ethers.utils.parseEther(_amount.toString());
const fromWei = (_amount) =>
	parseFloat(ethers.utils.formatEther(_amount.toString()));

const deadline = () => parseInt(Date.now() / 1000) + 60 * 60 * 5;

describe("UniqueNameToken", () => {
	let deployer, validator, user1, user2, user3, MINTING_FEE;
	let chainId, verifyingContract;
	const name = "UniqueNameToken";
	const version = "1";

	beforeEach(async () => {
		[deployer, validator, user1, user2, user3] = await ethers.getSigners();

		const ZooprPass = await ethers.getContractFactory("ZooprPass");
		const UniqueNameToken = await ethers.getContractFactory("UniqueNameToken");

		this.zooprPass = await ZooprPass.deploy("ZooprGenesisPass tokenURI");
		this.contract = await UniqueNameToken.deploy(this.zooprPass.address);

		// await this.contract.setGenesisPassAddress(this.zooprPass.address);

		chainId = await this.contract.chainId();
		verifyingContract = this.contract.address;

		await this.contract.grantRole(
			await this.contract.VALIDATOR_ROLE(),
			validator.address
		);
		MINTING_FEE = await this.contract.MINTING_FEE();
	});

	const _sigData = (_account, _username, _tokenURI, _mintFee, _deadline) => {
		const _data = {
			types: {
				UNT: [
					{ name: "account", type: "address" },
					{ name: "username", type: "string" },
					{ name: "tokenURI", type: "string" },
					{ name: "fees", type: "string" },
					{ name: "deadline", type: "string" },
				],
			},
			domain: { name, version, chainId, verifyingContract },
			primaryType: "UNT",
			message: {
				account: _account,
				username: _username,
				tokenURI: _tokenURI,
				fees: _mintFee ? _mintFee.toString() : "0",
				deadline: _deadline.toString(),
			},
		};

		return _data;
	};

	const _getTokenId = (_receipt) => _receipt.events[0].args["tokenId"];

	describe("deployment", () => {
		it("should deploy contract properly", () => {
			expect(this.contract.address).not.undefined;
		});

		it("should deploy contract properly", () => {
			expect(this.contract.address).not.null;
			expect(this.contract.address).not.undefined;
		});

		it("should set ADMIN wallet properly", async () => {
			expect(await this.contract.owner()).to.equal(deployer.address);
		});

		it("should grant DEFAULT_ADMIN_ROLE to deployer wallet", async () => {
			expect(
				await this.contract.hasRole(
					await this.contract.DEFAULT_ADMIN_ROLE(),
					deployer.address
				)
			).to.be.true;
		});

		it("should grant VALIDATOR_ROLE to deployer wallet", async () => {
			expect(
				await this.contract.hasRole(
					await this.contract.VALIDATOR_ROLE(),
					deployer.address
				)
			).to.be.true;
		});

		it("should set ZoopR Pass address properly", async () => {
			expect(await this.contract.ZooprPass()).to.equal(this.zooprPass.address);
		});

		it("should set initial stage details properly", async () => {
			expect(await this.contract.STAGE()).to.equal("SEED");
			expect(await this.contract.STAGE_CAP()).to.equal(1000);
			expect(parseInt(await this.contract.CAP())).to.equal(100_000);
			expect(fromWei(await this.contract.MINTING_FEE())).to.equal(0.08);
			expect(parseInt(await this.contract.stageCount())).to.equal(0);
		});
	});

	describe("mint", () => {
		const _tokenURI = "My token URI";

		it("should mint token properly", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _receipt = await this.contract
				.connect(user1)
				.mint(_encodedData, { value: MINTING_FEE });
			expect(
				await this.contract.ownerOf(_getTokenId(await _receipt.wait()))
			).to.equal(user1.address);
		});

		it("should increment stage count", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await this.contract
				.connect(user1)
				.mint(_encodedData, { value: MINTING_FEE });

			expect(parseInt(await this.contract.stageCount())).to.equal(1);
		});

		it("should transfer MINTING_FEE to admin", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(() =>
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).changeEtherBalances(
				[user1, deployer],
				[toWei(-1 * fromWei(MINTING_FEE)), MINTING_FEE]
			);
		});

		it("should refund excess MINTING_FEE to caller", async () => {
			const _username = "Test username";
			const _deadline = deadline();
			const _admin = await ethers.getSigner(await this.contract.owner());

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(() =>
				this.contract
					.connect(user1)
					.mint(_encodedData, { value: toWei(fromWei(MINTING_FEE) * 2) })
			).changeEtherBalances(
				[user1, _admin],
				[toWei(-1 * fromWei(MINTING_FEE)), MINTING_FEE]
			);
		});

		it("should update mint state", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _receipt = await this.contract
				.connect(user1)
				.mint(_encodedData, { value: MINTING_FEE });

			expect(
				await this.contract.ownerOf(_getTokenId(await _receipt.wait()))
			).to.equal(user1.address);
			expect(await this.contract.minted(_username)).to.be.true;
		});

		it("should set custom mint fees", async () => {
			const _username = "Test username";
			const _deadline = deadline();
			const _fees = toWei(1);

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				_fees,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				_fees,
				_deadline
			);

			await expect(() =>
				this.contract.connect(user1).mint(_encodedData, { value: _fees })
			).changeEtherBalances(
				[user1, deployer],
				[toWei(-1 * fromWei(_fees)), _fees]
			);
		});

		it("should reject invalid signature", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await user1._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).to.revertedWith("UniqueNameToken: Invalid mint data received!");
		});

		it("should reject duplicate minting", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);
			await this.contract
				.connect(user1)
				.mint(_encodedData, { value: MINTING_FEE });
			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).to.revertedWith("UniqueNameToken: Username has already been minted");
		});

		it("should reject duplicate name minting", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);

			await this.contract
				.connect(user1)
				.mint(
					await this.contract.encode(
						_signature,
						user1.address,
						_username,
						_tokenURI,
						MINTING_FEE,
						_deadline
					),
					{ value: MINTING_FEE }
				);

			// GENERATE MINT DATA TWO
			const {
				domain: domain2,
				types: types2,
				message: message2,
			} = _sigData(user2.address, _username, _tokenURI, MINTING_FEE, _deadline);

			const _signature2 = await validator._signTypedData(
				domain2,
				types2,
				message2
			);

			await expect(
				this.contract
					.connect(user2)
					.mint(
						await this.contract.encode(
							_signature2,
							user2.address,
							_username,
							_tokenURI,
							MINTING_FEE,
							_deadline
						),
						{ value: MINTING_FEE }
					)
			).to.revertedWith("UniqueNameToken: Username has already been minted");
		});

		it("should set tokenURI properly", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await this.contract
				.connect(user1)
				.mint(_encodedData, { value: MINTING_FEE });
			expect(await this.contract.tokenURI("0")).to.equal(_tokenURI);
		});

		it("should reject low MINTING_FEE", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);
			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: "0" })
			).to.revertedWith("UniqueNameToken: Insufficient minting fees");
		});

		it("should reject if stage cap is exceeded", async () => {
			await this.contract
				.connect(deployer)
				.updateStageDetail("TEST", 10, toWei(0.0001));

			for (let i = 1; i <= 10; i++) {
				const _deadline = deadline();
				const _username = i.toString();

				const { domain, types, message } = _sigData(
					user1.address,
					_username,
					i.toString(),
					MINTING_FEE,
					_deadline
				);

				const _signature = await validator._signTypedData(
					domain,
					types,
					message
				);
				const _encodedData = await this.contract.encode(
					_signature,
					user1.address,
					_username,
					i.toString(),
					MINTING_FEE,
					_deadline
				);

				await this.contract
					.connect(user1)
					.mint(_encodedData, { value: MINTING_FEE });
			}

			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).to.revertedWith("UniqueNameToken: Stage Cap exceeded");
		});

		it("should reject if cap is exceeded", async () => {
			await this.contract.connect(deployer).updateCap(5);
			for (let i = 1; i <= 5; i++) {
				const _deadline = deadline();
				const _username = i.toString();

				const { domain, types, message } = _sigData(
					user1.address,
					_username,
					i.toString(),
					MINTING_FEE,
					_deadline
				);

				const _signature = await validator._signTypedData(
					domain,
					types,
					message
				);
				const _encodedData = await this.contract.encode(
					_signature,
					user1.address,
					_username,
					i.toString(),
					MINTING_FEE,
					_deadline
				);

				await this.contract
					.connect(user1)
					.mint(_encodedData, { value: MINTING_FEE });

				expect(await this.contract.ownerOf(i - 1)).to.equal(user1.address);
			}

			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).to.revertedWith("UniqueNameToken: Maximum UNT cap exceeded");
		});

		it("should reject if signature have expired", async () => {
			const _username = "test username";
			const _deadline = "0";

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				MINTING_FEE,
				_deadline
			);

			await expect(
				this.contract.connect(user1).mint(_encodedData, { value: MINTING_FEE })
			).to.revertedWith("UniqueNameToken: Signature expired");
		});
	});

	describe("genesisPassMint", () => {
		const _tokenURI = "My token URI";

		beforeEach(async () => {
			await this.zooprPass.connect(user1).mint({
				value: await this.zooprPass.fees(),
			});
		});

		it("should mint token properly", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _receipt = await this.contract
				.connect(user1)
				.genesisPassMint(_encodedData);

			expect(
				await this.contract.ownerOf(_getTokenId(await _receipt.wait()))
			).to.equal(user1.address);
		});

		it("should not charge minting fees", async () => {
			const _username = "Test username";
			const _deadline = deadline();
			const _admin = await ethers.getSigner(await this.contract.owner());

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			await expect(() =>
				this.contract.connect(user1).genesisPassMint(_encodedData)
			).changeEtherBalances([user1, _admin], [0, 0]);
		});

		it("should update mint state", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _receipt = await this.contract
				.connect(user1)
				.genesisPassMint(_encodedData);

			expect(
				await this.contract.ownerOf(_getTokenId(await _receipt.wait()))
			).to.equal(user1.address);
			expect(await this.contract.minted(_username)).to.be.true;
			expect(await this.contract.genesisPass(user1.address)).to.be.true;
		});

		it("should reject duplicate Genesis Pass minting", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);
			await this.contract.connect(user1).genesisPassMint(_encodedData);
			await expect(
				this.contract.connect(user1).genesisPassMint(_encodedData)
			).to.revertedWith("UniqueNameToken: Username has already been minted");
		});

		it("should reject duplicate name minting", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);

			await this.contract
				.connect(user1)
				.mint(
					await this.contract.encode(
						_signature,
						user1.address,
						_username,
						_tokenURI,
						"0",
						_deadline
					),
					{ value: MINTING_FEE }
				);

			// GENERATE MINT DATA TWO
			const {
				domain: domain2,
				types: types2,
				message: message2,
			} = _sigData(user2.address, _username, _tokenURI, "0", _deadline);

			const _signature2 = await validator._signTypedData(
				domain2,
				types2,
				message2
			);

			await expect(
				this.contract
					.connect(user2)
					.genesisPassMint(
						await this.contract.encode(
							_signature2,
							user2.address,
							_username,
							_tokenURI,
							"0",
							_deadline
						)
					)
			).to.revertedWith("UniqueNameToken: Username has already been minted");
		});

		it("should set tokenURI properly", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			await this.contract.connect(user1).genesisPassMint(_encodedData);
			expect(await this.contract.tokenURI("0")).to.equal(_tokenURI);
		});

		it("should reject if cap is exceeded", async () => {
			await this.contract.connect(deployer).updateCap(5);

			for (let i = 1; i <= 5; i++) {
				const _deadline = deadline();
				const _username = i.toString();

				const { domain, types, message } = _sigData(
					user1.address,
					_username,
					i.toString(),
					"0",
					_deadline
				);

				const _signature = await validator._signTypedData(
					domain,
					types,
					message
				);
				const _encodedData = await this.contract.encode(
					_signature,
					user1.address,
					_username,
					i.toString(),
					"0",
					_deadline
				);

				await this.contract
					.connect(user1)
					.mint(_encodedData, { value: MINTING_FEE });
			}

			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			await expect(
				this.contract.connect(user1).genesisPassMint(_encodedData)
			).to.revertedWith("UniqueNameToken: Maximum UNT cap exceeded");
		});

		it("should reject if account does not have Genesis Pass", async () => {
			const _username = "Test username";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user2.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user2.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			await expect(
				this.contract.connect(user2).genesisPassMint(_encodedData)
			).to.revertedWith("UniqueNameToken: User does not have Genesis Pass");
		});

		it("should reject if Genesis permit have been used", async () => {
			const _username = "Username 1";
			const _deadline = deadline();

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);
			const {
				domain: domain2,
				types: types2,
				message: message2,
			} = _sigData(user1.address, "Username 2", _tokenURI, "0", _deadline);

			const _signature = await validator._signTypedData(domain, types, message);
			const _signature2 = await validator._signTypedData(
				domain2,
				types2,
				message2
			);

			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);
			const _encodedData2 = await this.contract.encode(
				_signature2,
				user1.address,
				"Username 2",
				_tokenURI,
				"0",
				_deadline
			);

			await this.contract.connect(user1).genesisPassMint(_encodedData);

			await expect(
				this.contract.connect(user1).genesisPassMint(_encodedData2)
			).to.revertedWith(
				"UniqueNameToken: ZoopR Pass free mint have already been used"
			);
		});

		it("should reject if signature have expired", async () => {
			const _username = "test username";
			const _deadline = "0";

			const { domain, types, message } = _sigData(
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			const _signature = await validator._signTypedData(domain, types, message);
			const _encodedData = await this.contract.encode(
				_signature,
				user1.address,
				_username,
				_tokenURI,
				"0",
				_deadline
			);

			await expect(
				this.contract.connect(user1).genesisPassMint(_encodedData)
			).to.revertedWith("UniqueNameToken: Signature expired");
		});
	});

	describe("updateStageDetail", () => {
		it("should update MINTING_FEE", async () => {
			await this.contract
				.connect(deployer)
				.updateStageDetail("TEST STAGE", 2000, toWei(1));

			expect(await this.contract.STAGE()).to.equal("TEST STAGE");
			expect(await this.contract.STAGE_CAP()).to.equal(2000);
			expect(fromWei(await this.contract.MINTING_FEE())).to.equal(1);
		});

		it("should reject if caller is not admin", async () => {
			await expect(
				this.contract
					.connect(user1)
					.updateStageDetail("TEST STAGE", 2000, toWei(1))
			).to.reverted;
		});

		it("should emit STAGE_CAP", async () => {
			await expect(
				this.contract
					.connect(deployer)
					.updateStageDetail("TEST STAGE", 2000, toWei(1))
			)
				.to.emit(this.contract, "STAGE_DETAIL")
				.withArgs("TEST STAGE", 2000, toWei(1));
		});
	});

	describe("updateCap", () => {
		it("should update cap", async () => {
			await this.contract.connect(deployer).updateCap(100_000_000);
			expect(await this.contract.CAP()).to.equal(100_000_000);
		});

		it("should reject if caller is not admin", async () => {
			await expect(this.contract.connect(user1).updateCap(toWei(1))).to
				.reverted;
		});
	});
});
