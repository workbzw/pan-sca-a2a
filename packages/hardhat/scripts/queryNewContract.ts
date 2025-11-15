import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件（从项目根目录）
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 查询新合约的推荐码信息
 */
async function main() {
  // 新合约地址
  const PAYMENT_SBT_ADDRESS = "0x1956f3E39c7a9Bdd8E35a0345379692C3f433898";
  
  // 获取网络配置
  const networkName = "bscTestnet";
  const network = config.networks[networkName];
  
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
    console.log("📊 新合约状态查询");
    console.log("=".repeat(80));

    // 1. 查询总 SBT 数量
    const totalSupply = await contract.totalSupply();
    console.log(`\n1️⃣  总 SBT 数量: ${totalSupply.toString()}`);
    
    // 2. 查询合约余额
    const balance = await provider.getBalance(PAYMENT_SBT_ADDRESS);
    console.log(`2️⃣  合约余额: ${ethers.formatEther(balance)} ETH`);
    
    // 3. 查询推荐码总数
    const referrerListLength = await contract.getReferrerListLength();
    console.log(`3️⃣  推荐码总数: ${referrerListLength.toString()}`);
    
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
        console.log(`\n   ${"排名".padEnd(6)}${"推荐码".padEnd(30)}${"推荐数量"}`);
        console.log(`   ${"-".repeat(50)}`);
        validReferrers.forEach((stat: any, index: number) => {
          const rank = (index + 1).toString().padEnd(6);
          const code = stat.code.padEnd(30);
          const count = stat.count.toString();
          console.log(`   ${rank}${code}${count}`);
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
    if (error.reason) {
      console.error("错误原因:", error.reason);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

