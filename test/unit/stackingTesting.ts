import { expect } from "chai";
import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { Address } from "cluster";

describe("Staking", function () {

  let stakingInstance: Contract;
  let daoInstance: Contract;
  let lpToken: Contract;
  let xxxToken: Contract;
  let router: Contract;
  let factory: Contract;

  let owner: SignerWithAddress;
  let staker1: SignerWithAddress;
  let staker2: SignerWithAddress;

  
  before(async function() {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.MAINNET_API}`,
            blockNumber: 14390400,
          },
        },
      ],
    });

    [owner, staker1, staker2] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("ACDMTokens");
    xxxToken = await Token.deploy("XXX Coin", "XXX", 18);
    await xxxToken.deployed();

    //Univ2 connction atempt
    router = (await ethers.getContractAt("IUniswapV2Router02", process.env.ROUTER2_ADDRESS as string));
    factory = (await ethers.getContractAt("IUniswapV2Factory", process.env.FACTORY_ADDRESS as string));

    await xxxToken.mint(staker1.address, 1000000);
    await xxxToken.mint(owner.address, 10000);
    await xxxToken.connect(staker1).approve(router.address, ethers.constants.MaxUint256);

    let deadline = new Date().getTime();

    await router.connect(staker1).addLiquidityETH(
      xxxToken.address,
      10000,
      0,
      ethers.utils.parseEther("1"),
      staker1.address,
      deadline, {value: ethers.utils.parseEther("1")}
    );
  });

  beforeEach(async function(){
    // Getting ContractFactory and Signers
    const pairAddress = await factory.getPair(process.env.WETH_ADDRESS, xxxToken.address);
    lpToken = await ethers.getContractAt("IUniswapV2Pair", pairAddress);

    const DAO = await ethers.getContractFactory("DAO");
    daoInstance = await DAO.deploy(owner.address, xxxToken.address, 800, 10000);
    await daoInstance.deployed();

    const Stacking = await ethers.getContractFactory("Stacking");
    stakingInstance = await Stacking.deploy(lpToken.address, xxxToken.address, daoInstance.address);
    await stakingInstance.deployed();

    await daoInstance.grantRole(daoInstance.CHAIR_MAN(), stakingInstance.address);
    await stakingInstance.grantRole(stakingInstance.DAO_ROLE(), daoInstance.address);
    
  });

  describe("Deploy", function(){
    it("Should return proper token addresses on deploy", async function() {
      expect(await stakingInstance.stakeToken()).to.eq(lpToken.address);
      expect(await stakingInstance.rewardToken()).to.eq(xxxToken.address);
      expect(await stakingInstance.dao()).to.eq(daoInstance.address);
    });

    it("Should have default reward coef values", async function() {
      expect(await stakingInstance.rewardCo()).to.eq(300);
      expect(await stakingInstance.rewardGenTime()).to.eq(7*86400);
      expect(await stakingInstance.tokenLockTime()).to.eq(30*86400);
      expect(await xxxToken.decimals()).to.eq(18);
    });
  });

  describe("Txs", function() {
    it("Should have new reward set", async function() {
      await stakingInstance.setReward(50);
      expect(await stakingInstance.rewardCo()).to.eq(50);
    });

    it("Should be reverted with too high reward", async function() {
      await expect(stakingInstance.setReward(20000)).to.be.revertedWith("Too high reward mf!");
    });

    it("Should be able to change min token locktime", async function() {
      await stakingInstance.grantRole(stakingInstance.DAO_ROLE(), owner.address);
      await stakingInstance.setLockTime(15);

      expect(await stakingInstance.tokenLockTime()).to.eq(15*86400);
    });

    it("Should be reverted with min token locktime is 1", async function() {
      await stakingInstance.grantRole(stakingInstance.DAO_ROLE(), owner.address);
      await expect(stakingInstance.setLockTime(0)).to.be.revertedWith("Min token locktime is 1 mf!");
    });

    it("Should be some staked tokens", async function() {
      await lpToken.connect(staker1).approve(stakingInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakingInstance.connect(staker1).stake(1000);

      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      expect(await lpToken.connect(staker1).balanceOf(stakingInstance.address)).to.eq(1000);
    });

    it("Should be able to unstake and then claim", async function() {
      await lpToken.connect(staker1).approve(stakingInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakingInstance.connect(staker1).stake(1000);
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);

      //mint some reward tokens
      await xxxToken.mint(stakingInstance.address, 10000);

      await ethers.provider.send('evm_increaseTime', [86400*32]);
      await ethers.provider.send('evm_mine', []);

      //unstake and check
      await stakingInstance.connect(staker1).unstake();
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(0);
    });
    
    it("Should be able to claim and then unstake", async function() {
      await lpToken.connect(staker1).approve(stakingInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakingInstance.connect(staker1).stake(1000);
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);

      //mint some reward tokens
      await xxxToken.mint(stakingInstance.address, 10000);

      await ethers.provider.send('evm_increaseTime', [86400*32]);
      await ethers.provider.send('evm_mine', []);

      //unstake and check
      await stakingInstance.connect(staker1).claim();
      await stakingInstance.connect(staker1).unstake();
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(0);
    });

    it("Should be claimable", async function() {
      let balance: number = +(await xxxToken.balanceOf(staker1.address));
      await lpToken.connect(staker1).approve(stakingInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakingInstance.connect(staker1).stake(1000);
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);
      await stakingInstance.setReward(50);

      //mint some reward tokens
      await xxxToken.mint(stakingInstance.address, 10000);

      await ethers.provider.send('evm_increaseTime', [86400*32]);
      await ethers.provider.send('evm_mine', []);

      //claim and check
      await stakingInstance.connect(staker1).claim();
      expect(await xxxToken.balanceOf(staker1.address)).to.eq(balance + 20);
    });

    it("Should revert with too soon to unstake", async function() {
      await lpToken.connect(staker1).approve(stakingInstance.address, ethers.utils.parseUnits("0.001", await lpToken.decimals()));
      
      //stake some tokens
      await stakingInstance.connect(staker1).stake(1000);
      expect(await stakingInstance.connect(staker1).getStakeAmount(staker1.address)).to.eq(1000);

      //unstake and check
      await expect(stakingInstance.connect(staker1).unstake()).to.be.revertedWith("Too soon to unstake mf!");
    });

    it("Should revert with nothing to unstake", async function() {
      await ethers.provider.send('evm_increaseTime', [86400*32]);
      await ethers.provider.send('evm_mine', []);

      await expect(stakingInstance.connect(staker1).unstake()).to.be.revertedWith("Nothing to unstake mf!");
    });

    it("Should revert if not a staker", async function() {
      await ethers.provider.send('evm_increaseTime', [86400*32]);
      await ethers.provider.send('evm_mine', []);

      await expect(stakingInstance.claim()).to.be.revertedWith("You are not a staker mf!");
    });
  });
});