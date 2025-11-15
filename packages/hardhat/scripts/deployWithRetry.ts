/**
 * 带重试机制的部署脚本
 * 用于处理 RPC 节点不稳定的情况
 */

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployWithRetry: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🏗️  使用重试机制部署 Agent Store 合约...\n");

  // 重试函数
  const deployWithRetryLogic = async (
    name: string,
    options: any,
    maxRetries: number = 3,
    delay: number = 5000
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`\n📦 部署 ${name} (尝试 ${attempt}/${maxRetries})...`);
        const result = await deploy(name, options);
        if (result.newlyDeployed) {
          console.log(`✅ ${name} 部署成功: ${result.address}`);
        } else {
          console.log(`⏭️  ${name} 已存在: ${result.address}`);
        }
        return result;
      } catch (error: any) {
        console.log(`❌ ${name} 部署失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`⏳ 等待 ${delay / 1000} 秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.log(`\n💥 ${name} 部署失败，已重试 ${maxRetries} 次`);
          throw error;
        }
      }
    }
  };

  try {
    // Step 1: Deploy IdentityRegistry
    const identityRegistry = await deployWithRetryLogic(
      "IdentityRegistry",
      { from: deployer, log: true },
      3,
      5000
    );

    // Step 2: Deploy ReputationRegistry
    const reputationRegistry = await deployWithRetryLogic(
      "ReputationRegistry",
      { from: deployer, log: true },
      3,
      5000
    );

    // Step 3: Deploy ValidationRegistry
    const validationRegistry = await deployWithRetryLogic(
      "ValidationRegistry",
      { from: deployer, log: true },
      3,
      5000
    );

    // Step 4: Deploy AgentStore
    const agentStore = await deployWithRetryLogic(
      "AgentStore",
      {
        from: deployer,
        args: [
          identityRegistry.address,
          reputationRegistry.address,
          validationRegistry.address,
        ],
        log: true,
      },
      5, // AgentStore 重试次数更多
      10000 // 等待时间更长
    );

    // 显示部署摘要
    console.log("\n📋 部署摘要:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("IdentityRegistry:    ", identityRegistry.address);
    console.log("ReputationRegistry:  ", reputationRegistry.address);
    console.log("ValidationRegistry:  ", validationRegistry.address);
    console.log("AgentStore:          ", agentStore.address);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("🎉 所有合约部署完成！\n");
  } catch (error: any) {
    console.error("\n💥 部署过程中发生错误:", error.message);
    console.log("\n💡 建议:");
    console.log("1. 检查网络连接");
    console.log("2. 尝试使用备用 RPC 节点:");
    console.log("   BSC_TESTNET_RPC='https://data-seed-prebsc-2-s1.binance.org:8545/' yarn deploy --network bscTestnet");
    console.log("3. 等待几分钟后重试");
    throw error;
  }
};

export default deployWithRetry;
deployWithRetry.tags = ["AgentStoreRetry"];

