import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys the Agent Store contracts (EIP-8004 implementation)
 * 
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployAgentStore: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🏗️  Deploying Agent Store contracts...\n");

  // 重试函数，用于处理 RPC 限流
  const deployWithRetry = async (
    name: string,
    options: any,
    maxRetries: number = 5,
    delay: number = 10000
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`   ⏳ 等待 ${delay / 1000} 秒后重试 (${attempt}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return await deploy(name, options);
      } catch (error: any) {
        const isRateLimit = error.message?.includes("Unable to complete request") || 
                           error.message?.includes("rate limit") ||
                           error.message?.includes("timeout");
        
        if (isRateLimit && attempt < maxRetries) {
          console.log(`   ⚠️  ${name} 部署遇到限流/超时，将重试...`);
          // 每次重试增加延迟时间
          delay = Math.min(delay * 1.5, 30000); // 最多 30 秒
        } else {
          throw error;
        }
      }
    }
  };

  // Step 1: Deploy IdentityRegistry
  console.log("1️⃣  Deploying IdentityRegistry...");
  const identityRegistry = await deployWithRetry("IdentityRegistry", {
    from: deployer,
    log: true,
    // 如果合约已部署且代码未改变，会跳过部署
  });
  if (identityRegistry.newlyDeployed) {
    console.log("✅ IdentityRegistry deployed at:", identityRegistry.address);
  } else {
    console.log("⏭️  IdentityRegistry already deployed at:", identityRegistry.address);
  }

  // Step 2: Deploy ReputationRegistry
  console.log("\n2️⃣  Deploying ReputationRegistry...");
  // 在部署之间添加延迟，避免触发限流
  await new Promise(resolve => setTimeout(resolve, 3000));
  const reputationRegistry = await deployWithRetry("ReputationRegistry", {
    from: deployer,
    log: true,
  });
  if (reputationRegistry.newlyDeployed) {
    console.log("✅ ReputationRegistry deployed at:", reputationRegistry.address);
  } else {
    console.log("⏭️  ReputationRegistry already deployed at:", reputationRegistry.address);
  }

  // Step 3: Deploy ValidationRegistry
  console.log("\n3️⃣  Deploying ValidationRegistry...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  const validationRegistry = await deployWithRetry("ValidationRegistry", {
    from: deployer,
    log: true,
  });
  if (validationRegistry.newlyDeployed) {
    console.log("✅ ValidationRegistry deployed at:", validationRegistry.address);
  } else {
    console.log("⏭️  ValidationRegistry already deployed at:", validationRegistry.address);
  }

  // Step 4: Deploy AgentStore (main contract)
  // 注意：如果合约代码改变了，需要删除旧的部署记录或使用 reset 标志
  console.log("\n4️⃣  Deploying AgentStore...");
  await new Promise(resolve => setTimeout(resolve, 3000));
  const agentStore = await deployWithRetry("AgentStore", {
    from: deployer,
    args: [
      identityRegistry.address,
      reputationRegistry.address,
      validationRegistry.address,
    ],
    log: true,
    // 如果合约代码改变了，hardhat-deploy 会自动检测并重新部署
  }, 7, 15000); // AgentStore 重试次数更多，延迟更长
  if (agentStore.newlyDeployed) {
    console.log("✅ AgentStore newly deployed at:", agentStore.address);
  } else {
    console.log("⚠️  AgentStore already deployed at:", agentStore.address);
    console.log("   如果合约代码已修改，请删除部署记录后重新部署:");
    console.log("   rm packages/hardhat/deployments/bscTestnet/AgentStore.json");
  }

  // 显示部署摘要（不进行链上验证，避免 RPC 错误）
  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("IdentityRegistry:    ", identityRegistry.address);
  console.log("ReputationRegistry:  ", reputationRegistry.address);
  console.log("ValidationRegistry:  ", validationRegistry.address);
  console.log("AgentStore:          ", agentStore.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 可选：链上验证（如果 RPC 可用）
  console.log("🔍 尝试验证部署（可选）...");
  try {
    const agentStoreContract = await hre.ethers.getContract<Contract>("AgentStore", deployer);
    const identityAddr = await agentStoreContract.identityRegistry();
    const reputationAddr = await agentStoreContract.reputationRegistry();
    const validationAddr = await agentStoreContract.validationRegistry();
    console.log("✅ 链上验证成功:");
    console.log("   IdentityRegistry:    ", identityAddr);
    console.log("   ReputationRegistry:  ", reputationAddr);
    console.log("   ValidationRegistry:  ", validationAddr);
  } catch (error: any) {
    console.log("⚠️  链上验证失败（可能是 RPC 限流），但合约已成功部署");
    console.log("   错误:", error.message);
  }

  console.log("\n🎉 Agent Store deployment complete!\n");
};

export default deployAgentStore;

deployAgentStore.tags = ["AgentStore", "EIP8004"];

