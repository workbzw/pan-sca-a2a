import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件（从项目根目录）
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 检查合约状态和推荐人信息
 */
async function main() {
  // 获取网络配置
  const networkName = process.argv[2] || "bscTestnet";
  const network = config.networks[networkName];
  
  // 尝试从命令行参数获取合约地址，如果没有则从 deployedContracts 读取
  let PAYMENT_SBT_ADDRESS: string;
  
  // 检查是否有命令行参数（跳过 --network 参数）
  const addressArg = process.argv.find((arg, index) => 
    index > 0 && 
    process.argv[index - 1] !== "--network" && 
    arg.startsWith("0x") && 
    arg.length === 42
  );
  
  if (addressArg) {
    PAYMENT_SBT_ADDRESS = addressArg;
    console.log(`📌 使用命令行指定的合约地址: ${PAYMENT_SBT_ADDRESS}`);
  } else {
    // 尝试从 deployedContracts 读取
    try {
      const deployedContractsPath = path.join(__dirname, "../../nextjs/contracts/deployedContracts.ts");
      const deployedContractsContent = fs.readFileSync(deployedContractsPath, "utf-8");
      const addressMatch = deployedContractsContent.match(/97:\s*{[^}]*PaymentSBT:\s*{[^}]*address:\s*"([^"]+)"/s);
      
      if (addressMatch && addressMatch[1]) {
        PAYMENT_SBT_ADDRESS = addressMatch[1];
        console.log(`📌 从 deployedContracts.ts 读取的合约地址: ${PAYMENT_SBT_ADDRESS}`);
      } else {
        PAYMENT_SBT_ADDRESS = "0x110CC702FC4968d231eFD6E08Db75776265b6A1B";
        console.log(`📌 使用默认合约地址: ${PAYMENT_SBT_ADDRESS}`);
      }
    } catch (error) {
      PAYMENT_SBT_ADDRESS = "0x110CC702FC4968d231eFD6E08Db75776265b6A1B";
      console.log(`📌 使用默认合约地址: ${PAYMENT_SBT_ADDRESS}`);
    }
  }
  
  if (!network || !("url" in network)) {
    console.error(`❌ 网络 ${networkName} 未配置或无效`);
    return;
  }

  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`📄 合约地址: ${PAYMENT_SBT_ADDRESS}\n`);

  // 创建 provider
  const provider = new ethers.JsonRpcProvider(network.url);
  
  // 创建合约实例
  const contract = new ethers.Contract(PAYMENT_SBT_ADDRESS, PaymentSBT_ABI, provider);

  try {
    console.log("=".repeat(80));
    console.log("📊 合约状态查询");
    console.log("=".repeat(80));
    
    // 1. 查询总供应量
    const totalSupply = await contract.totalSupply();
    console.log(`\n1️⃣  总 SBT 数量: ${totalSupply.toString()}`);
    
    // 2. 查询合约余额
    const contractBalance = await contract.getContractBalance();
    console.log(`2️⃣  合约余额: ${ethers.formatEther(contractBalance)} ETH`);
    
    // 3. 查询推荐人总数
    const referrerListLength = await contract.getReferrerListLength();
    console.log(`3️⃣  推荐人总数: ${referrerListLength.toString()}`);
    
    // 4. 查询所有推荐码统计（过滤空字符串）
    console.log(`\n4️⃣  推荐码详细信息:`);
    const [referrers, counts] = await contract.getReferrerStats();
    
    if (referrers.length === 0) {
      console.log("   📭 目前还没有推荐码记录");
    } else {
      const validReferrers = referrers
        .map((referrer: string, index: number) => ({
          code: referrer,
          count: Number(counts[index]),
        }))
        .filter((stat: any) => stat.code.trim().length > 0);
      
      if (validReferrers.length === 0) {
        console.log("   📭 目前还没有有效的推荐码记录（已过滤空字符串）");
      } else {
        validReferrers.sort((a: any, b: any) => b.count - a.count);
        console.log(`   ✅ 有效推荐码数量: ${validReferrers.length}`);
        validReferrers.forEach((stat: any, index: number) => {
          console.log(`   ${(index + 1).toString().padStart(3)}. "${stat.code}" - ${stat.count} 个推荐`);
        });
      }
    }
    
    // 5. 查询最近的几个 SBT 的推荐码信息（如果有的话）
    if (totalSupply > 0n) {
      console.log(`\n5️⃣  最近 5 个 SBT 的推荐码信息:`);
      const checkCount = totalSupply > 5n ? 5 : Number(totalSupply);
      
      for (let i = 0; i < checkCount; i++) {
        const tokenId = totalSupply - BigInt(i);
        try {
          const paymentInfo = await contract.getPaymentInfo(tokenId);
          const referrer = paymentInfo.referrer;
          const isEmpty = referrer.trim().length === 0;
          
          console.log(`   Token ID ${tokenId.toString().padStart(6)}: ${isEmpty ? "❌ 无推荐码" : `✅ "${referrer}"`}`);
        } catch (error: any) {
          console.log(`   Token ID ${tokenId.toString().padStart(6)}: ❌ 查询失败 - ${error.message}`);
        }
      }
    }
    
    // 6. 查询稀有度统计
    const commonCount = await contract.getRarityCount(0); // Common
    const rareCount = await contract.getRarityCount(1);   // Rare
    console.log(`\n6️⃣  稀有度统计:`);
    console.log(`   Common: ${commonCount.toString()}`);
    console.log(`   Rare: ${rareCount.toString()}`);
    
    console.log("\n" + "=".repeat(80));
    
  } catch (error: any) {
    console.error("❌ 查询失败:", error.message);
    if (error.data) {
      console.error("错误详情:", error.data);
    }
    console.error("完整错误:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

