import * as dotenv from "dotenv";
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
dotenv.config();

describe("ACADEM PLATFORM", function () {

    let tokenInstance: Contract;
    let platformInstance: Contract;
    let daoInstance: Contract;

    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("ACDMTokens");
        tokenInstance = await Token.deploy("Academ Coin", "ACDM", 6);
        await tokenInstance.deployed();

        const DAO = await ethers.getContractFactory("DAO");
        daoInstance = await DAO.deploy(owner.address, tokenInstance.address, 800, 10000);
        await daoInstance.deployed();

        const AcademPlatform = await ethers.getContractFactory("AcademPlatform");
        platformInstance = await AcademPlatform.deploy(daoInstance.address, tokenInstance.address, 3);
        await platformInstance.deployed();

        await tokenInstance.grantRole(tokenInstance.MINTER_ROLE(), platformInstance.address);
    });

    describe("Deploy", function () {
        it("Should return proper token addresses on deploy", async function () {
            expect(platformInstance.address).to.be.properAddress;
            expect(tokenInstance.address).to.be.properAddress;
        });
    });

    describe("Txs", function () {
        it("Should be registered user without referrer", async function () {
            await platformInstance["register()"]();
            expect((await platformInstance.users(owner.address))[0]).to.eq(true);
        });

        it("Should be registered user with referrer", async function () {
            await platformInstance["register()"]();
            await platformInstance.connect(addr1)["register(address)"](owner.address);
            expect((await platformInstance.users(addr1.address))[1]).to.eq(owner.address);
        });

        it("Should be reverted if user already registered", async function () {
            await platformInstance["register()"]();
            await expect(platformInstance["register()"]()).to.be.revertedWith('AlreadyRegistered');
        });

        it("Should be reverted if user already registered (with referral)", async function () {
            await platformInstance["register()"]();
            await expect(platformInstance["register(address)"](addr1.address)).to.be.revertedWith('AlreadyRegistered');
        });

        it("Should be reverted if user self referring", async function () {
            await expect(platformInstance["register(address)"](owner.address)).to.be.revertedWith('SelfReffering');
        });

        it("Should be reverted if referrer is not registered", async function () {
            await expect(platformInstance["register(address)"](addr1.address)).to.be.revertedWith('Uregistered');
        });

        it("Should be able to start sale round", async function () {
            expect(await platformInstance.startSaleRound())
            .to
            .emit(platformInstance, 'SaleStarted')
            .withArgs(1, (await platformInstance.rounds(1))[1]);
            expect((await platformInstance.rounds(1))[1]).to.not.eq(0);
        });

        it("Should be able to start trade round", async function () {
            await platformInstance.startSaleRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);

            expect(await platformInstance.startTradeRound())
            .to
            .emit(platformInstance, 'TradeStarted')
            .withArgs(1, (await platformInstance.rounds(1))[1]);
            expect((await platformInstance.rounds(1))[0]).to.eq(1);
        });

        it("Should revert if sale already started", async function () {
            await platformInstance.startSaleRound();

            await expect(platformInstance.startSaleRound()).to.be.revertedWith('AlreadyStarted');
        });

        it("Should revert if trade NotFinished", async function () {
            await platformInstance.startSaleRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await expect(platformInstance.startSaleRound()).to.be.revertedWith('NotFinished');
        });

        it("Should revert if trade already started", async function () {
            await platformInstance.startSaleRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await expect(platformInstance.startTradeRound()).to.be.revertedWith('AlreadyStarted');
        });

        it("Should revert if sale NotFinished", async function () {
            await platformInstance.startSaleRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startSaleRound();

            await expect(platformInstance.startTradeRound()).to.be.revertedWith('NotFinished');
        });

        it("Should be able to buy tokens during sale round", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            expect(await tokenInstance.balanceOf(owner.address)).to.eq(1000);
        });

        it("Should be able to send bonuses to referrers during sale", async function () {
            await platformInstance.startSaleRound();
            await platformInstance.connect(addr1)["register()"]();
            await platformInstance.connect(addr2)["register(address)"](addr1.address);
            await platformInstance["register(address)"](addr2.address);

            await platformInstance.buyACDM(100000, {value: "1000000000000000000"});

            expect(await tokenInstance.balanceOf(owner.address)).to.eq(100000);
        });

        it("Should be reverted if unregistered user trying to buy", async function () {
            await platformInstance.startSaleRound();
            await expect(platformInstance.buyACDM(1000)).to.be.revertedWith('Uregistered');
        });

        it("Should be reverted if user buys when trade not finished yet", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await expect(platformInstance.buyACDM(1000)).to.be.revertedWith('NotFinished("trade")');
        });

        it("Should be reverted if user buys when sale finished already", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);

            await expect(platformInstance.buyACDM(1000)).to.be.revertedWith('AlreadyFinished("sale")');
        });

        it("Should be reverted if buy amount higher than mint amount", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await expect(platformInstance.buyACDM(10000000)).to.be.revertedWith('AmountExeeded(100000, 10000000)');
        });

        it("Should be reverted if buy amount higher than user eth balance", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await expect(platformInstance.buyACDM(1000, {value: 0})).to.be.revertedWith('AmountExeeded(0, 10000000000000000)');
        });

        it("Should be able to add order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);
        });

        it("Should be reverted if unregistered user tries to add order", async function () {
            await platformInstance.startSaleRound();
            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await expect(platformInstance.addOrder(1000, 100)).to.be.revertedWith('Uregistered');
        });

        it("Should be reverted if user adds order when sale not finished yet", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await expect(platformInstance.addOrder(1000, 100)).to.be.revertedWith('NotFinished("sale")');
        });

        it("Should be reverted if user adds order when trade already finished", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);

            await expect(platformInstance.addOrder(1000, 100)).to.be.revertedWith('AlreadyFinished("trade")');
        });

        it("Should be reverted if order amount higher than balance", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await expect(platformInstance.addOrder(10000, 100)).to.be.revertedWith('AmountExeeded');
        });

        it("Should be able to add and remove order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.removeOrder(0);
            expect((await platformInstance.orders(0))[3]).to.eq(false);
        });

        it("Should be reverted if user tries to remove someone's order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await tokenInstance.decimals();
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await expect(platformInstance.connect(addr1).removeOrder(0)).to.be.revertedWith("Not an owner");
        });

        it("Should be reverted if user tries to remove non existing order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.removeOrder(0);
            await expect(platformInstance.removeOrder(0)).to.be.revertedWith("No such order");
        });

        it("Should be reverted if user tries to remove order when trade not began", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startSaleRound();

            await expect(platformInstance.removeOrder(0)).to.be.revertedWith('NotFinished("sale")');
        });

        it("Should be reverted if user tries to remove order when trade already finished", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);

            await expect(platformInstance.removeOrder(0)).to.be.revertedWith('AlreadyFinished("trade")');
        });

        it("Should be reverted if unregistered user tries to redeem order", async function () {
            await expect(platformInstance.connect(addr1).redeemOrder(0, 1000)).to.be.revertedWith('Uregistered');
        });

        it("Should be reverted if user tries to redeem non existing order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.removeOrder(0);
            await expect(platformInstance.redeemOrder(0, 1000)).to.be.revertedWith("No such order");
        });

        it("Should be reverted if user tries to redeem when trade isnt started yet", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startSaleRound();

            await expect(platformInstance.redeemOrder(0, 1000)).to.be.revertedWith('NotFinished("sale")');
        });

        it("Should be reverted if user tries to redeem order when trade already finished", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);

            await expect(platformInstance.redeemOrder(0, 1000)).to.be.revertedWith('AlreadyFinished("trade")');
        });
  
        it("Should be reverted if user tries to redeem order with amount higher than order amount", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await expect(platformInstance.redeemOrder(0, 10000)).to.be.revertedWith('AmountExeeded');
        });

        it("Should be reverted if user tries to redeem order without paying", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await expect(platformInstance.redeemOrder(0, 1000)).to.be.revertedWith('AmountExeeded');
        });

        it("Should be able to redeem order", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();
            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.redeemOrder(0, 1000, {value: 100000});
            expect((await platformInstance.orders(0))[3]).to.eq(false);
        });

        it("Should be able to redeem order partly", async function () {
            await platformInstance.startSaleRound();
            await platformInstance["register()"]();

            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.redeemOrder(0, 500, {value: 50000});
            expect((await platformInstance.orders(0))[1]).to.eq(500);
        });

        it("Should be able to send bonus to refferer", async function () {
            await platformInstance.startSaleRound();
            await platformInstance.connect(addr1)["register()"]();
            await platformInstance.connect(addr2)["register(address)"](addr1.address);
            await platformInstance["register(address)"](addr2.address);

            await platformInstance.buyACDM(1000, {value: "10000000000000000"});

            await ethers.provider.send('evm_increaseTime', [86400*4]);
            await ethers.provider.send('evm_mine', []);
            await platformInstance.startTradeRound();

            await tokenInstance.approve(platformInstance.address, 1000);
            await platformInstance.addOrder(1000, 100);
            expect((await platformInstance.orders(0))[3]).to.eq(true);

            await platformInstance.redeemOrder(0, 1000, {value: 100000});
            expect((await platformInstance.orders(0))[3]).to.eq(false);
        });

        it("Should be able change bonuses", async function () {
            await platformInstance.grantRole(platformInstance.DAO_ROLE(), owner.address);
            await platformInstance.setBonuses(1000, 1000, 1000, 1000);

            expect(await platformInstance.bonuses(0)).to.eq(1000);
        });
    });
});