import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "solidity-coverage";

dotenv.config();

import "./task/DAO/addProposal.ts";
import "./task/DAO/vote.ts";
import "./task/DAO/finishProposal.ts";
import "./task/Platform/addOrder.ts";
import "./task/Platform/redeemOrder.ts";
import "./task/Platform/removeOrder.ts";
import "./task/Platform/startSale.ts";
import "./task/Platform/startTrade.ts";
import "./task/Platform/buyACDM.ts";
import "./task/Staking/stake.ts";
import "./task/Staking/unstake.ts";

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: "0.8.4",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.MAINNET_API}`,
        blockNumber: 12851120,
      },
      chainId: 1337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    rinkeby: {
      accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      url: process.env.ALCHEMY_URL,
      chainId: 4,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API,
  },
};

export default config;
