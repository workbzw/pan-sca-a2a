import { ethers } from "ethers";
import { config } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// 读取 ABI 文件
const abiPath = path.join(__dirname, "../../../PAYMENT_SBT_ABI.json");
const PaymentSBT_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/**
 * 测试带推荐人的付款功能
 * 
 * 使用方法:
 *   yarn hardhat run scripts/testReferrerPayment.ts --network bscTestnet
 * 
 * 注意: 需要设置环境变量 DEPLOYER_PRIVATE_KEY 或使用已配置的钱包
 */
async function main() {
  const networkName = process.argv[2] || "bscTestnet";
  const network = config.networks[networkName];
  
  if (!network || !("url" in network)) {
    console.error(`❌ 网络 ${networkName} 未配置或无效`);
    return;
  }

  // 获取合约地址（使用新合约地址）
  let PAYMENT_SBT_ADDRESS: string;
  try {
    const deployedContractsPath = path.join(__dirname, "../../nextjs/contracts/deployedContracts.ts");
    const deployedContractsContent = fs.readFileSync(deployedContractsPath, "utf-8");
    const addressMatch = deployedContractsContent.match(/97:\s*{[^}]*PaymentSBT:\s*{[^}]*address:\s*"([^"]+)"/s);
    PAYMENT_SBT_ADDRESS = addressMatch && addressMatch[1] ? addressMatch[1] : "0x1956f3E39c7a9Bdd8E35a0345379692C3f433898";
  } catch (error) {
    PAYMENT_SBT_ADDRESS = "0x1956f3E39c7a9Bdd8E35a0345379692C3f433898"; // 新合约地址
  }

  console.log(`📡 连接到网络: ${networkName}`);
  console.log(`📍 RPC URL: ${network.url}`);
  console.log(`📄 合约地址: ${PAYMENT_SBT_ADDRESS}\n`);

  // 创建 provider 和 signer
  const provider = new ethers.JsonRpcProvider(network.url);
  
  // 获取私钥（优先使用 TESTPRI，然后是其他环境变量）
  const privateKey = process.env.TESTPRI || 
                     process.env.DEPLOYER_PRIVATE_KEY || 
                     process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ||
                     "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat account #0
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`👤 使用账户: ${wallet.address}`);
  
  // 检查余额
  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 账户余额: ${ethers.formatEther(balance)} ETH\n`);
  
  if (balance < ethers.parseEther("0.001")) {
    console.log("⚠️  余额不足，无法进行测试付款");
    return;
  }

  // 创建合约实例
  const contract = new ethers.Contract(PAYMENT_SBT_ADDRESS, PaymentSBT_ABI, wallet);

  try {
    // 测试参数
    const recipient = wallet.address; // 接收 SBT 的地址（使用付款者自己的地址）
    const description = "Test payment with referrer";
    const referrer = "REF123"; // 示例推荐码（可以修改）
    const paymentAmount = ethers.parseEther("0.001"); // 0.001 ETH

    console.log("=".repeat(80));
    console.log("🧪 测试推荐码付款功能");
    console.log("=".repeat(80));
    console.log(`接收 SBT 地址: ${recipient}`);
    console.log(`推荐码: "${referrer}"`);
    console.log(`付款金额: ${ethers.formatEther(paymentAmount)} ETH`);
    console.log(`描述: ${description}\n`);

    // 调用 makePayment
    console.log("📤 发送交易...");
    const tx = await contract.makePayment(recipient, description, referrer, {
      value: paymentAmount,
    });

    console.log(`⏳ 交易哈希: ${tx.hash}`);
    console.log("等待交易确认...");

    const receipt = await tx.wait();
    console.log(`✅ 交易已确认，区块号: ${receipt.blockNumber}`);

    // 从事件中获取 tokenId
    const mintEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === "SBTMinted";
      } catch {
        return false;
      }
    });

    if (mintEvent) {
      const parsed = contract.interface.parseLog(mintEvent);
      const tokenId = parsed?.args[0];
      const rarity = parsed?.args[4];
      
      console.log(`\n🎉 SBT 铸造成功!`);
      console.log(`   Token ID: ${tokenId.toString()}`);
      console.log(`   稀有度: ${rarity === 0 ? "Common" : "Rare"}`);
      
      // 查询付款信息验证推荐人
      const paymentInfo = await contract.getPaymentInfo(tokenId);
      console.log(`\n📋 付款信息:`);
      console.log(`   金额: ${ethers.formatEther(paymentInfo.amount)} ETH`);
      console.log(`   付款人: ${paymentInfo.payer}`);
      console.log(`   接收人: ${paymentInfo.recipient}`);
      console.log(`   推荐码: "${paymentInfo.referrer}"`);
      console.log(`   描述: ${paymentInfo.description}`);
      console.log(`   时间戳: ${new Date(Number(paymentInfo.timestamp) * 1000).toLocaleString()}`);
      
      if (paymentInfo.referrer === referrer) {
        console.log(`\n✅ 推荐码信息已正确记录!`);
      } else {
        console.log(`\n❌ 推荐码信息不匹配!`);
      }
    }

    // 查询推荐码统计
    console.log(`\n📊 查询推荐码统计...`);
    const [referrers, counts] = await contract.getReferrerStats();
    const referrerIndex = referrers.findIndex((code: string) => code === referrer);
    
    if (referrerIndex !== -1) {
      console.log(`✅ 推荐码 "${referrer}" 的推荐数量: ${counts[referrerIndex].toString()}`);
    } else {
      console.log(`⚠️  推荐码 "${referrer}" 未在统计中找到`);
    }

  } catch (error: any) {
    console.error("❌ 测试失败:", error.message);
    if (error.reason) {
      console.error("错误原因:", error.reason);
    }
    if (error.data) {
      console.error("错误详情:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

