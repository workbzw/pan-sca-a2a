import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentityRegistry, ReputationRegistry, ValidationRegistry, AgentStore } from "../typechain-types";

describe("AgentStore", function () {
  let identityRegistry: IdentityRegistry;
  let reputationRegistry: ReputationRegistry;
  let validationRegistry: ValidationRegistry;
  let agentStore: AgentStore;
  let owner: any;
  let user1: any;
  let user2: any;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    // 部署三个注册表
    const IdentityRegistryFactory = await ethers.getContractFactory("IdentityRegistry");
    identityRegistry = await IdentityRegistryFactory.deploy();
    await identityRegistry.waitForDeployment();

    const ReputationRegistryFactory = await ethers.getContractFactory("ReputationRegistry");
    reputationRegistry = await ReputationRegistryFactory.deploy();
    await reputationRegistry.waitForDeployment();

    const ValidationRegistryFactory = await ethers.getContractFactory("ValidationRegistry");
    validationRegistry = await ValidationRegistryFactory.deploy();
    await validationRegistry.waitForDeployment();

    // 部署 AgentStore
    const AgentStoreFactory = await ethers.getContractFactory("AgentStore");
    agentStore = await AgentStoreFactory.deploy(
      await identityRegistry.getAddress(),
      await reputationRegistry.getAddress(),
      await validationRegistry.getAddress()
    );
    await agentStore.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy all contracts successfully", async function () {
      expect(await identityRegistry.getAddress()).to.be.properAddress;
      expect(await reputationRegistry.getAddress()).to.be.properAddress;
      expect(await validationRegistry.getAddress()).to.be.properAddress;
      expect(await agentStore.getAddress()).to.be.properAddress;
    });

    it("Should set correct registry addresses", async function () {
      expect(await agentStore.identityRegistry()).to.equal(await identityRegistry.getAddress());
      expect(await agentStore.reputationRegistry()).to.equal(await reputationRegistry.getAddress());
      expect(await agentStore.validationRegistry()).to.equal(await validationRegistry.getAddress());
    });
  });

  describe("Agent Registration and Listing", function () {
    it("Should register and list an agent", async function () {
      const metadataURI = "ipfs://QmTest123";
      const name = "Test Agent";
      const description = "A test agent";
      const category = 0; // General

      const tx = await agentStore
        .connect(user1)
        .registerAndListAgent(metadataURI, name, description, category);
      
      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // 检查身份是否注册
      const agentId = 1n;
      const identity = await identityRegistry.getAgentIdentity(agentId);
      expect(identity.owner).to.equal(user1.address);
      expect(identity.metadataURI).to.equal(metadataURI);
      expect(identity.active).to.be.true;

      // 检查是否上架
      const listing = await agentStore.listings(agentId);
      expect(listing.name).to.equal(name);
      expect(listing.description).to.equal(description);
      expect(listing.listed).to.be.true;
      expect(listing.owner).to.equal(user1.address);
    });

    it("Should get all listed agents", async function () {
      // 注册两个 agents
      await agentStore
        .connect(user1)
        .registerAndListAgent("ipfs://1", "Agent 1", "Description 1", 0);
      
      await agentStore
        .connect(user2)
        .registerAndListAgent("ipfs://2", "Agent 2", "Description 2", 1);

      const allAgents = await agentStore.getAllListedAgents();
      expect(allAgents.length).to.equal(2);
      expect(allAgents[0]).to.equal(1n);
      expect(allAgents[1]).to.equal(2n);
    });

    it("Should allow unlisting an agent", async function () {
      await agentStore
        .connect(user1)
        .registerAndListAgent("ipfs://1", "Agent 1", "Description 1", 0);

      await agentStore.connect(user1).unlistAgent(1n);

      const listing = await agentStore.listings(1n);
      expect(listing.listed).to.be.false;
    });

    it("Should prevent non-owner from unlisting", async function () {
      await agentStore
        .connect(user1)
        .registerAndListAgent("ipfs://1", "Agent 1", "Description 1", 0);

      await expect(
        agentStore.connect(user2).unlistAgent(1n)
      ).to.be.revertedWith("AgentStore: Not owner");
    });
  });

  describe("Reputation System", function () {
    beforeEach(async () => {
      await agentStore
        .connect(user1)
        .registerAndListAgent("ipfs://1", "Agent 1", "Description 1", 0);
    });

    it("Should submit a rating", async function () {
      await agentStore
        .connect(user2)
        .submitRating(1n, 5, "Great agent!");

      const reputation = await reputationRegistry.getReputation(1n);
      expect(reputation.totalRatings).to.equal(1n);
      expect(reputation.averageRating).to.equal(5000n); // 5 * 1000
    });

    it("Should calculate average rating correctly", async function () {
      await agentStore.connect(user2).submitRating(1n, 5, "Great!");
      await agentStore.connect(owner).submitRating(1n, 3, "Okay");

      const reputation = await reputationRegistry.getReputation(1n);
      expect(reputation.totalRatings).to.equal(2n);
      expect(reputation.averageRating).to.equal(4000n); // (5+3)/2 * 1000 = 4000
    });

    it("Should prevent duplicate reviews", async function () {
      await agentStore.connect(user2).submitRating(1n, 5, "Great!");

      await expect(
        agentStore.connect(user2).submitRating(1n, 4, "Good")
      ).to.be.revertedWith("ReputationRegistry: Already reviewed");
    });
  });

  describe("Usage Tracking", function () {
    beforeEach(async () => {
      await agentStore
        .connect(user1)
        .registerAndListAgent("ipfs://1", "Agent 1", "Description 1", 0);
    });

    it("Should track agent usage", async function () {
      await agentStore.connect(user2).recordUsage(1n);
      await agentStore.connect(owner).recordUsage(1n);

      const listing = await agentStore.listings(1n);
      expect(listing.usageCount).to.equal(2n);
    });
  });
});

