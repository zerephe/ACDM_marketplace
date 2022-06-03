import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";

describe("Dao", function () {

  let tokenInstance: Contract;
  let daoInstance: Contract;

  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function(){
    [owner, addr1] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("ACDMTokens", owner);
    const tokenInstance = await Token.deploy("XXX Coin", "XXX", 18);
    await tokenInstance.deployed();

    const DAO = await ethers.getContractFactory("DAO");
    daoInstance = await DAO.deploy(owner.address, tokenInstance.address, 800, 10000);
    await daoInstance.deployed();

    await tokenInstance.mint(owner.address, 1000);
    await tokenInstance.mint(addr1.address, 1000);
  });

  describe("Deploy", function(){
    it("Should return proper token addresses on deploy", async function() {
      expect(daoInstance.address).to.be.properAddress;
      expect(tokenInstance.address).to.be.properAddress;
    });

    it("Should be valid initial values", async function() {
      expect(await daoInstance.chairMan()).to.eq(owner.address);
      expect(await daoInstance.voteToken()).to.eq(tokenInstance.address);
      expect(await daoInstance.minQ()).to.eq(800);
      expect(await daoInstance.debatePeriod()).to.eq(10000);
    });
  });

  describe("Txs", function() {
    it("Should be able to update chairman", async function() {
      await daoInstance.updateChairMan(addr1.address);
      expect(await daoInstance.chairMan()).to.eq(addr1.address);
      expect(await daoInstance.hasRole(daoInstance.CHAIR_MAN(), addr1.address)).to.eq(true);
    });

    it("Should be able to deposit", async function() {
      await tokenInstance.approve(daoInstance.address, 100);
      await daoInstance.deposit(100);
      const depoAmount = await daoInstance.voters(owner.address);
      expect(depoAmount[0]).to.eq(100);
    });

    it("Should be able to add Proposal", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      const proposal = await daoInstance.proposals(0);
      expect(proposal.timeStamp).to.not.eq(0);
    });

    it("Should be able to Vote", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 100);
      await daoInstance.deposit(100);
      await daoInstance.vote(0, 100, true);
      
      expect(await daoInstance.getProposalPositions(0, true)).to.eq(100);
      expect(await daoInstance.getVoterPositionForProposal(owner.address, 0)).to.eq(100);
    });

    it("Should be reverted if proposal already doesn't exist", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 100);
      await daoInstance.deposit(100);

      await ethers.provider.send('evm_increaseTime', [60000]);
      await ethers.provider.send('evm_mine', []);

      await expect(daoInstance.vote(0, 100, true)).to.be.revertedWith("Proposal doesn't exist!");
    });

    it("Should be reverted if vote count exeeded", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 100);
      await daoInstance.deposit(100);

      await expect(daoInstance.vote(0, 200, true)).to.be.revertedWith("Not enough votes!");
    });

    it("Should be able to finish proposal successfully", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      await daoInstance.vote(0, 1000, true);

      await ethers.provider.send('evm_increaseTime', [60000]);
      await ethers.provider.send('evm_mine', []);

      await daoInstance.finishProposal(0);

      expect(await daoInstance.minQ()).to.eq(500);
    });

    it("Should be able to finish proposal UNsuccessfully", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      await daoInstance.vote(0, 1000, false);

      await ethers.provider.send('evm_increaseTime', [60000]);
      await ethers.provider.send('evm_mine', []);

      await daoInstance.finishProposal(0);

      expect(await daoInstance.minQ()).to.eq(800);
    });

    it("Should be reverted if call was not successfull", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParam(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParam',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      await daoInstance.vote(0, 1000, true);

      await ethers.provider.send('evm_increaseTime', [60000]);
      await ethers.provider.send('evm_mine', []);

      await expect(daoInstance.finishProposal(0)).to.be.revertedWith("ERROR call func");
    });

    it("Should be reverted if there's no such proposal", async function() {
      await expect(daoInstance.finishProposal(0)).to.be.revertedWith("Proposal doesn't exist!");
    });

    it("Should be able to finish proposal UNsuccessfully", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      await daoInstance.vote(0, 1000, false);

      await expect(daoInstance.finishProposal(0)).to.be.revertedWith("Too soon to finish!");
    });

    it("Should be able to finish proposal UNsuccessfully", async function() {
      const iface = new ethers.utils.Interface([
        "function updateProposalParams(address _voteTokenAddress, uint256 _minQ, uint256 _dabatePeriod)"
      ]);
      const voteTokenAddress = addr1.address;
      const calldata = iface.encodeFunctionData('updateProposalParams',[voteTokenAddress, 500, 5000]);

      await daoInstance.addProposal(daoInstance.address, calldata, "Update token, min quorum, debate period");

      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      await daoInstance.vote(0, 500, false);
      
      await ethers.provider.send('evm_increaseTime', [60000]);
      await ethers.provider.send('evm_mine', []);

      await expect(daoInstance.finishProposal(0)).to.be.revertedWith("MinQ doesnt reached!");
    });

    it("Should be able to withdraw deposited tokens", async function() {
      await tokenInstance.approve(daoInstance.address, 1000);
      await daoInstance.deposit(1000);
      expect(await tokenInstance.balanceOf(daoInstance.address)).to.eq(1000);

      await daoInstance.withdraw(500);
      expect(await tokenInstance.balanceOf(owner.address)).to.eq(500);
      expect(await tokenInstance.balanceOf(daoInstance.address)).to.eq(500);
    });

    it("Should be reverted if not enough tokens to withdraw", async function() {
      await expect(daoInstance.withdraw(500)).to.be.revertedWith("No such amount deposited!");
    });
  });
});