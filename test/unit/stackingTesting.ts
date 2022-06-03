import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { Address } from "cluster";

describe("DemirBank staking", function () {

  let stakeInstance: Contract;
  let lpToken: Contract;
  let tokenVLC: Contract;
  let router: Contract;
  let factory: Contract;

  let owner: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;

  
  before(async function() {
    const Token1 = await ethers.getContractFactory("VolkovCoin");
    [owner, staker1, staker2] = await ethers.getSigners();
    tokenVLC = await Token1.deploy("VolkovCoin", "VLC");
    await tokenVLC.deployed();

    //Univ2 connction atempt
    router = (await ethers.getContractAt("IUniswapV2Router02", process.env.ROUTER2_ADDRESS as string));
    factory = (await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));

    await tokenVLC._mint(staker1.address, ethers.utils.parseUnits("1000", await tokenVLC.decimals()));
    await tokenVLC.connect(staker1).approve(router.address, ethers.constants.MaxUint256);

    let deadline = new Date().getTime();

    await router.connect(staker1).addLiquidityETH(
      tokenVLC.address,
      ethers.utils.parseUnits("1000", await tokenVLC.decimals()),
      0,
      ethers.utils.parseEther("1"),
      staker1.address,
      deadline, {value: ethers.utils.parseEther("1")}
    );
  });

  beforeEach(async function(){
    // Getting ContractFactory and Signers
    const pairAddress = await factory.getPair(process.env.WETH_ADDRESS, tokenVLC.address);
    lpToken = await ethers.getContractAt("IUniswapV2Pair", pairAddress);

    const Token = await ethers.getContractFactory("DemirBank");
    stakeInstance = await Token.deploy(lpToken.address, tokenVLC.address);
    await stakeInstance.deployed();
  });

  describe("Deploy", function(){
    it("Should return proper token addresses on deploy", async function() {
      expect(await stakeInstance.stakeToken()).to.eq(lpToken.address);
      expect(await stakeInstance.rewardToken()).to.eq(tokenVLC.address);
    });

    it("Should have default reward coef values", async function() {
      expect(await stakeInstance.rewardCo()).to.eq(25);
      expect(await stakeInstance.rewardLockTime()).to.eq(10);
      expect(await stakeInstance.tokenLockTime()).to.eq(20);
    });
  });

  describe("Txs", function() {
    it("Should have new reward set", async function() {
      await stakeInstance.setReward(50);
      expect(await stakeInstance.rewardCo()).to.eq(50);
    });

    it("Should be reverted with too high reward", async function() {
      await expect(stakeInstance.setReward(200)).to.be.revertedWith("Too high reward mf!");
    });

    it("Should be reverted with min token locktime is 1", async function() {
      await expect(stakeInstance.setLockTime(0, 0)).to.be.revertedWith("Min token locktime is 1 mf!");
    });

    it("Should be reverted with min reward locktime is higher", async function() {
      await expect(stakeInstance.setLockTime(1, 0)).to.be.revertedWith("Min reward locktime is higher mf!");
    });

    it("Should be some staked tokens", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakeInstance.connect(staker1).stake(1000);

      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      expect(await lpToken.connect(staker1).balanceOf(stakeInstance.address)).to.eq(1000);
    });

    it("Should be able to unstake and then claim", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      await stakeInstance.setLockTime(1, 2);

      //mint some reward tokens
      await tokenVLC._mint(stakeInstance.address, 10000);

      await new Promise(resolve => setTimeout(resolve, 2000));

      //unstake and check
      await stakeInstance.connect(staker1).unstake();
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(0);
    });
    
    it("Should be able to claim and then unstake", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      await stakeInstance.setLockTime(1, 2);

      //mint some reward tokens
      await tokenVLC._mint(stakeInstance.address, 10000);

      await new Promise(resolve => setTimeout(resolve, 2000));

      //unstake and check
      await stakeInstance.connect(staker1).claim();
      await stakeInstance.connect(staker1).unstake();
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(0);
    });

    it("Should be claimable", async function() {
      let balance: number = +(await tokenVLC.balanceOf(staker1.address));
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      await stakeInstance.setLockTime(1, 2);
      await stakeInstance.setReward(50);

      //mint some reward tokens
      await tokenVLC._mint(stakeInstance.address, 10000);

      await new Promise(resolve => setTimeout(resolve, 2000));

      //claim and check
      await stakeInstance.connect(staker1).claim();
      expect(await tokenVLC.balanceOf(staker1.address)).to.eq(balance + 500);
    });

    it("Should revert with too soon to unstake", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);

      //unstake and check
      await expect(stakeInstance.connect(staker1).unstake()).to.be.revertedWith("Too soon to unstake mf!");
    });

    it("Should revert with nothing to unstake", async function() {
      await stakeInstance.setLockTime(1, 2);

      await new Promise(resolve => setTimeout(resolve, 2000));

      await expect(stakeInstance.connect(staker1).unstake()).to.be.revertedWith("Nothing to unstake mf!");
    });

    it("Should revert with too soon to claim", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);

      await expect(stakeInstance.connect(staker1).claim()).to.be.revertedWith("Too soon to claim reward mf!");
    });

    it("Should revert if not a staker", async function() {
      await stakeInstance.setLockTime(1, 2);

      await new Promise(resolve => setTimeout(resolve, 2000));

      await expect(stakeInstance.connect(staker1).claim()).to.be.revertedWith("You are not a staker mf!");
    });

    it("Should revert with nothing to claim", async function() {
      await lpToken.connect(staker1).approve(stakeInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      await stakeInstance.connect(staker1).stake(1000);
      expect(await stakeInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      await stakeInstance.setLockTime(1, 2);
      await tokenVLC._mint(stakeInstance.address, 10000);

      await new Promise(resolve => setTimeout(resolve, 2000));

      await stakeInstance.connect(staker1).claim();

      await expect(stakeInstance.connect(staker1).claim()).to.be.revertedWith("Nothing to claim mf!");
    });
  });
});