import * as dotenv from "dotenv";
import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
dotenv.config();

describe("Dao", function () {

  let tokenInstance: Contract;
  let daoInstance: Contract;
  let stakingInstance: Contract;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function(){
    [owner, addr1] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ACDMTokens");
    tokenInstance = await Token.deploy("XXX Coin", "XXX", 18);
    await tokenInstance.deployed();

    const DAO = await ethers.getContractFactory("DAO");
    daoInstance = await DAO.deploy(owner.address, tokenInstance.address, 800, 10000);
    await daoInstance.deployed();
    
    const Stacking = await ethers.getContractFactory("Stacking");
    stakingInstance = await Stacking.deploy(tokenInstance.address, tokenInstance.address, daoInstance.address);
    await stakingInstance.deployed();

    await daoInstance.grantRole(daoInstance.CHAIR_MAN(), stakingInstance.address);
    await owner.sendTransaction({
      to: daoInstance.address,
      value: 1000,
      gasLimit: 30000
    });
    await tokenInstance.mint(owner.address, 10000);
    await tokenInstance.mint(addr1.address, 10000);
  });

  describe("Deploy", function(){
    it("Should return proper token addresses on deploy", async function() {
      expect(daoInstance.address).to.be.properAddress;
      expect(tokenInstance.address).to.be.properAddress;
    });

    it("Should be valid initial values", async function() {
      expect(await daoInstance.chairMan()).to.eq(owner.address);
      expect(await daoInstance.minQ()).to.eq(800);
      expect(await daoInstance.debatePeriod()).to.eq(10000);
    });
  });

  describe("Txs", function() {
    
  });
});