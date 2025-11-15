import { ethers } from "ethers";
import { config } from "hardhat";

async function main() {
  const networkName = "bscTestnet";
  const network = config.networks[networkName];
  
  if (!network || !("url" in network)) {
    console.error(`❌ 网络 ${networkName} 未配置或无效`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(network.url);
  const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`👤 查询地址: ${address}\n`);
  
  try {
    const balance = await provider.getBalance(address);
    console.log(`💰 账户余额: ${ethers.formatEther(balance)} BNB`);
    console.log(`💰 账户余额 (Wei): ${balance.toString()}`);
    
    // 获取最近的交易
    const blockNumber = await provider.getBlockNumber();
    console.log(`\n📦 当前区块号: ${blockNumber}`);
    
    // 检查是否有交易历史
    const txCount = await provider.getTransactionCount(address);
    console.log(`📊 交易数量: ${txCount}`);
    
  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

