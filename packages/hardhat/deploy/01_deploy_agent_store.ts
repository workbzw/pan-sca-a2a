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

  // Step 1: Deploy IdentityRegistry
  console.log("1️⃣  Deploying IdentityRegistry...");
  const identityRegistry = await deploy("IdentityRegistry", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  console.log("✅ IdentityRegistry deployed at:", identityRegistry.address);

  // Step 2: Deploy ReputationRegistry
  console.log("\n2️⃣  Deploying ReputationRegistry...");
  const reputationRegistry = await deploy("ReputationRegistry", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  console.log("✅ ReputationRegistry deployed at:", reputationRegistry.address);

  // Step 3: Deploy ValidationRegistry
  console.log("\n3️⃣  Deploying ValidationRegistry...");
  const validationRegistry = await deploy("ValidationRegistry", {
    from: deployer,
    log: true,
    autoMine: true,
  });
  console.log("✅ ValidationRegistry deployed at:", validationRegistry.address);

  // Step 4: Deploy AgentStore (main contract)
  console.log("\n4️⃣  Deploying AgentStore...");
  const agentStore = await deploy("AgentStore", {
    from: deployer,
    args: [
      identityRegistry.address,
      reputationRegistry.address,
      validationRegistry.address,
    ],
    log: true,
    autoMine: true,
  });
  console.log("✅ AgentStore deployed at:", agentStore.address);

  // Verify deployments
  const agentStoreContract = await hre.ethers.getContract<Contract>("AgentStore", deployer);
  const identityAddr = await agentStoreContract.identityRegistry();
  const reputationAddr = await agentStoreContract.reputationRegistry();
  const validationAddr = await agentStoreContract.validationRegistry();

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("IdentityRegistry:    ", identityAddr);
  console.log("ReputationRegistry:  ", reputationAddr);
  console.log("ValidationRegistry:  ", validationAddr);
  console.log("AgentStore:          ", agentStore.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("🎉 Agent Store deployment complete!\n");
};

export default deployAgentStore;

deployAgentStore.tags = ["AgentStore", "EIP8004"];

