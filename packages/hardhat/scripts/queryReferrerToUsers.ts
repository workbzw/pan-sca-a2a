import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件（从项目根目录）
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 查询推荐码推荐的所有用户地址
 * 
 * 使用方法:
 *   yarn hardhat run scripts/queryReferrerToUsers.ts --network bscTestnet [推荐码]
 *   如果不提供推荐码，会查询所有推荐码
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

  // 获取推荐码参数（从环境变量或命令行参数）
  // 使用方法: REFERRER_CODE=REF123 yarn hardhat run scripts/queryReferrerToUsers.ts --network bscTestnet
  const referrerCode = process.env.REFERRER_CODE || null;

  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`📄 合约地址: ${PAYMENT_SBT_ADDRESS}\n`);

  // 创建 provider
  const provider = new ethers.JsonRpcProvider(network.url);
  
  // 创建合约实例
  const contract = new ethers.Contract(PAYMENT_SBT_ADDRESS, PaymentSBT_ABI, provider);

  try {
    let referrersToQuery: string[] = [];

    if (referrerCode) {
      // 查询指定的推荐码
      referrersToQuery = [referrerCode];
      console.log(`🔍 查询推荐码: "${referrerCode}"\n`);
    } else {
      // 查询所有推荐码
      console.log(`🔍 查询所有推荐码\n`);
      const allReferrers = await contract.getAllReferrers();
      referrersToQuery = allReferrers.filter((code: string) => code.trim().length > 0);
      
      if (referrersToQuery.length === 0) {
        console.log("📭 目前还没有推荐码记录");
        return;
      }
    }

    console.log("=".repeat(80));
    console.log(`📊 推荐码 -> 被推荐人地址查询结果`);
    console.log("=".repeat(80));

    for (const referrer of referrersToQuery) {
      console.log(`\n📌 推荐码: "${referrer}"`);
      
      // 获取该推荐码的所有 Token ID
      const tokenIds = await contract.getTokensByReferrer(referrer);
      
      if (tokenIds.length === 0) {
        console.log(`   📭 该推荐码还没有推荐记录`);
        continue;
      }

      console.log(`   📦 总 Token 数量: ${tokenIds.length}`);

      // 获取每个 Token 的被推荐人地址（去重）
      const userAddresses = new Set<string>();
      const userDetails: Array<{
        address: string;
        tokenIds: bigint[];
        firstTime: number;
        lastTime: number;
      }> = [];

      for (const tokenId of tokenIds) {
        try {
          const owner = await contract.ownerOf(tokenId); // 被推荐的用户地址
          const paymentInfo = await contract.getPaymentInfo(tokenId);
          
          userAddresses.add(owner.toLowerCase());
          
          // 查找或创建用户详情
          let userDetail = userDetails.find(u => u.address.toLowerCase() === owner.toLowerCase());
          if (!userDetail) {
            userDetail = {
              address: owner,
              tokenIds: [],
              firstTime: Number(paymentInfo.timestamp),
              lastTime: Number(paymentInfo.timestamp)
            };
            userDetails.push(userDetail);
          }
          
          userDetail.tokenIds.push(tokenId);
          const timestamp = Number(paymentInfo.timestamp);
          if (timestamp < userDetail.firstTime) {
            userDetail.firstTime = timestamp;
          }
          if (timestamp > userDetail.lastTime) {
            userDetail.lastTime = timestamp;
          }
        } catch (error: any) {
          console.log(`   ⚠️  Token ID ${tokenId} 查询失败: ${error.message}`);
        }
      }

      console.log(`   👥 唯一被推荐人数量: ${userAddresses.size}`);
      console.log(`\n   ${"序号".padEnd(6)}${"被推荐人地址".padEnd(45)}${"Token数量".padEnd(12)}${"首次推荐时间"}`);
      console.log(`   ${"-".repeat(80)}`);

      // 按首次推荐时间排序
      userDetails.sort((a, b) => a.firstTime - b.firstTime);

      userDetails.forEach((user, index) => {
        const rank = (index + 1).toString().padEnd(6);
        const address = user.address.padEnd(45);
        const count = user.tokenIds.length.toString().padEnd(12);
        const firstTime = new Date(user.firstTime * 1000).toLocaleString();
        console.log(`   ${rank}${address}${count}${firstTime}`);
      });

      // 显示详细信息（可选）
      if (userDetails.length <= 10) {
        console.log(`\n   📋 详细信息:`);
        userDetails.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.address}`);
          console.log(`      Token IDs: ${user.tokenIds.join(", ")}`);
          console.log(`      首次推荐: ${new Date(user.firstTime * 1000).toLocaleString()}`);
          console.log(`      最后推荐: ${new Date(user.lastTime * 1000).toLocaleString()}`);
        });
      }
    }

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

