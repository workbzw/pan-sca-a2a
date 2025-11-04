import { expect } from "chai";
import { ethers } from "hardhat";
import { PaymentSBT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PaymentSBT", function () {
  let paymentSBT: PaymentSBT;
  let owner: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let recipient: HardhatEthersSigner;
  let recipient2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, payer, recipient, recipient2] = await ethers.getSigners();

    const PaymentSBTFactory = await ethers.getContractFactory("PaymentSBT");
    paymentSBT = await PaymentSBTFactory.deploy();
    await paymentSBT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("应该正确部署", async function () {
      expect(await paymentSBT.getAddress()).to.be.properAddress;
      expect(await paymentSBT.totalSupply()).to.equal(0);
    });
  });

  describe("单次付款", function () {
    it("应该成功付款并发放SBT", async function () {
      const amount = ethers.parseEther("0.1");
      const description = "测试付款";
      
      const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
      
      const tx = await paymentSBT.connect(payer).makePayment(
        recipient.address,
        description,
        { value: amount }
      );
      const receipt = await tx.wait();
      
      // 检查Token被创建
      const tokenId = 1n;
      expect(await paymentSBT.exists(tokenId)).to.be.true;
      expect(await paymentSBT.ownerOf(tokenId)).to.equal(payer.address);
      expect(await paymentSBT.balanceOf(payer.address)).to.equal(1);
      expect(await paymentSBT.totalSupply()).to.equal(1);
      
      // 检查付款信息
      const paymentInfo = await paymentSBT.getPaymentInfo(tokenId);
      expect(paymentInfo.amount).to.equal(amount);
      expect(paymentInfo.payer).to.equal(payer.address);
      expect(paymentInfo.recipient).to.equal(recipient.address);
      expect(paymentInfo.description).to.equal(description);
      
      // 检查资金已转账
      const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);
      
      // 检查事件
      const paymentEvent = receipt?.logs.find(
        (log: any) => paymentSBT.interface.parseLog(log as any)?.name === "PaymentReceived"
      );
      expect(paymentEvent).to.not.be.undefined;
    });

    it("应该拒绝零金额付款", async function () {
      await expect(
        paymentSBT.connect(payer).makePayment(recipient.address, "测试", { value: 0 })
      ).to.be.revertedWith("PaymentSBT: Payment amount must be greater than 0");
    });

    it("应该拒绝无效的收款地址", async function () {
      const amount = ethers.parseEther("0.1");
      await expect(
        paymentSBT.connect(payer).makePayment(ethers.ZeroAddress, "测试", { value: amount })
      ).to.be.revertedWith("PaymentSBT: Invalid recipient");
    });
  });

  describe("批量付款", function () {
    it("应该成功批量付款并发放多个SBT", async function () {
      const recipients = [recipient.address, recipient2.address];
      const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
      const descriptions = ["付款1", "付款2"];
      
      const totalAmount = amounts[0] + amounts[1];
      const recipient1BalanceBefore = await ethers.provider.getBalance(recipient.address);
      const recipient2BalanceBefore = await ethers.provider.getBalance(recipient2.address);
      
      const tx = await paymentSBT.connect(payer).makeBatchPayment(
        recipients,
        amounts,
        descriptions,
        { value: totalAmount }
      );
      await tx.wait();
      
      // 检查Token被创建
      expect(await paymentSBT.exists(1)).to.be.true;
      expect(await paymentSBT.exists(2)).to.be.true;
      expect(await paymentSBT.balanceOf(payer.address)).to.equal(2);
      expect(await paymentSBT.totalSupply()).to.equal(2);
      
      // 检查付款信息
      const paymentInfo1 = await paymentSBT.getPaymentInfo(1);
      expect(paymentInfo1.amount).to.equal(amounts[0]);
      expect(paymentInfo1.recipient).to.equal(recipient.address);
      
      const paymentInfo2 = await paymentSBT.getPaymentInfo(2);
      expect(paymentInfo2.amount).to.equal(amounts[1]);
      expect(paymentInfo2.recipient).to.equal(recipient2.address);
      
      // 检查资金已转账
      const recipient1BalanceAfter = await ethers.provider.getBalance(recipient.address);
      const recipient2BalanceAfter = await ethers.provider.getBalance(recipient2.address);
      expect(recipient1BalanceAfter - recipient1BalanceBefore).to.equal(amounts[0]);
      expect(recipient2BalanceAfter - recipient2BalanceBefore).to.equal(amounts[1]);
    });

    it("应该拒绝长度不匹配的数组", async function () {
      const recipients = [recipient.address, recipient2.address];
      const amounts = [ethers.parseEther("0.1")]; // 长度不匹配
      const descriptions = ["付款1", "付款2"];
      
      await expect(
        paymentSBT.connect(payer).makeBatchPayment(
          recipients,
          amounts,
          descriptions,
          { value: ethers.parseEther("1") }
        )
      ).to.be.revertedWith("PaymentSBT: Arrays length mismatch");
    });

    it("应该退还多余的付款", async function () {
      const recipients = [recipient.address];
      const amounts = [ethers.parseEther("0.1")];
      const descriptions = ["付款1"];
      const excessAmount = ethers.parseEther("0.5");
      const totalSent = amounts[0] + excessAmount;
      
      const payerBalanceBefore = await ethers.provider.getBalance(payer.address);
      
      const tx = await paymentSBT.connect(payer).makeBatchPayment(
        recipients,
        amounts,
        descriptions,
        { value: totalSent }
      );
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const payerBalanceAfter = await ethers.provider.getBalance(payer.address);
      // 检查多余金额被退还（考虑gas费用）
      const expectedBalance = payerBalanceBefore - amounts[0] - gasUsed;
      expect(payerBalanceAfter).to.be.closeTo(expectedBalance, ethers.parseEther("0.01"));
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      // 创建一些测试数据
      await paymentSBT.connect(payer).makePayment(
        recipient.address,
        "付款1",
        { value: ethers.parseEther("0.1") }
      );
      await paymentSBT.connect(payer).makePayment(
        recipient2.address,
        "付款2",
        { value: ethers.parseEther("0.2") }
      );
    });

    it("应该正确返回用户拥有的Token", async function () {
      const tokens = await paymentSBT.getTokensByOwner(payer.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1n);
      expect(tokens[1]).to.equal(2n);
    });

    it("应该正确返回收款地址的付款记录", async function () {
      const payments = await paymentSBT.getPaymentsByRecipient(recipient.address);
      expect(payments.length).to.equal(1);
      expect(payments[0]).to.equal(1n);
      
      const payments2 = await paymentSBT.getPaymentsByRecipient(recipient2.address);
      expect(payments2.length).to.equal(1);
      expect(payments2[0]).to.equal(2n);
    });

    it("应该正确返回Token的拥有者", async function () {
      expect(await paymentSBT.ownerOf(1)).to.equal(payer.address);
      expect(await paymentSBT.balanceOf(payer.address)).to.equal(2);
    });

    it("应该正确处理不存在的Token", async function () {
      await expect(paymentSBT.ownerOf(999)).to.be.revertedWith(
        "PaymentSBT: Token does not exist"
      );
      await expect(paymentSBT.getPaymentInfo(999)).to.be.revertedWith(
        "PaymentSBT: Token does not exist"
      );
      expect(await paymentSBT.exists(999)).to.be.false;
    });
  });
});

