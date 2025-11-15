//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./EIP8004/IdentityRegistry.sol";
import "./EIP8004/ReputationRegistry.sol";
import "./EIP8004/ValidationRegistry.sol";

/**
 * @title AgentStore
 * @notice Agent 商店主合约，集成 EIP-8004 功能
 * @dev 提供完整的 Agent 注册、发现、评价和管理功能
 * @dev 使用 OpenZeppelin Ownable, ReentrancyGuard 和 Address 库保证安全性
 */
contract AgentStore is Ownable, ReentrancyGuard {
    using Address for address payable;
    IdentityRegistry public identityRegistry;
    ReputationRegistry public reputationRegistry;
    ValidationRegistry public validationRegistry;

    struct AgentListing {
        uint256 agentId;           // Agent ID
        string agentCardLink;      // AgentCard 链接（所有信息从 Agent Card 获取）
        address owner;             // 所有者
        bool listed;               // 是否上架
        uint256 listedAt;          // 上架时间
        uint256 usageCount;        // 使用次数
    }

    // Agent ID => Listing
    mapping(uint256 => AgentListing) public listings;
    
    
    // 所有上架的 Agent IDs
    uint256[] public allListedAgents;
    
    // 搜索关键词 => Agent IDs（简化版，实际可用链下索引）
    mapping(string => uint256[]) public searchIndex;

    // 事件
    event AgentListed(
        uint256 indexed agentId,
        string agentCardLink,
        address indexed owner,
        uint256 timestamp
    );
    
    event AgentUnlisted(
        uint256 indexed agentId,
        address indexed owner
    );
    
    event AgentUsed(
        uint256 indexed agentId,
        address indexed user,
        uint256 timestamp
    );

    constructor(
        address _identityRegistry,
        address _reputationRegistry,
        address _validationRegistry
    ) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "AgentStore: Invalid identity registry");
        require(_reputationRegistry != address(0), "AgentStore: Invalid reputation registry");
        require(_validationRegistry != address(0), "AgentStore: Invalid validation registry");
        
        identityRegistry = IdentityRegistry(_identityRegistry);
        reputationRegistry = ReputationRegistry(_reputationRegistry);
        validationRegistry = ValidationRegistry(_validationRegistry);
    }

    /**
     * @notice 注册并上架 Agent（只需要 AgentCard 链接）
     * @param agentCardLink AgentCard 链接（所有信息从 Agent Card 获取）
     * @return agentId 新创建的 Agent ID
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function registerAndListAgent(
        string memory agentCardLink
    ) public nonReentrant returns (uint256 agentId) {
        // 注册身份（使用 agentCardLink 作为 metadataURI）
        agentId = identityRegistry.registerAgent(agentCardLink);
        
        // 创建上架信息
        listings[agentId] = AgentListing({
            agentId: agentId,
            agentCardLink: agentCardLink,
            owner: msg.sender,
            listed: true,
            listedAt: block.timestamp,
            usageCount: 0
        });
        
        allListedAgents.push(agentId);
        
        emit AgentListed(agentId, agentCardLink, msg.sender, block.timestamp);
        
        return agentId;
    }

    /**
     * @notice 更新 Agent 的 AgentCard 链接
     * @param agentId Agent ID
     * @param agentCardLink 新的 AgentCard 链接
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function updateAgentCardLink(
        uint256 agentId,
        string memory agentCardLink
    ) public nonReentrant {
        require(listings[agentId].owner == msg.sender, "AgentStore: Not owner");
        require(listings[agentId].listed, "AgentStore: Not listed");
        
        listings[agentId].agentCardLink = agentCardLink;
    }

    /**
     * @notice 下架 Agent
     * @param agentId Agent ID
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function unlistAgent(uint256 agentId) public nonReentrant {
        require(listings[agentId].owner == msg.sender, "AgentStore: Not owner");
        require(listings[agentId].listed, "AgentStore: Not listed");
        
        listings[agentId].listed = false;
        
        emit AgentUnlisted(agentId, msg.sender);
    }


    /**
     * @notice 提交评价
     * @param agentId Agent ID
     * @param rating 评分 (1-5)
     * @param comment 评价内容
     */
    function submitRating(
        uint256 agentId,
        uint8 rating,
        string memory comment
    ) public {
        reputationRegistry.submitFeedback(agentId, rating, comment);
    }

    /**
     * @notice 获取所有上架的 Agents
     * @return agentIds Agent ID 数组
     */
    function getAllListedAgents() public view returns (uint256[] memory agentIds) {
        return allListedAgents;
    }

    /**
     * @notice 记录 Agent 使用（价格从 Agent Card 获取，通过 PaymentSBT 合约处理）
     * @param agentId Agent ID
     * @dev 使用 nonReentrant 防止重入攻击
     * @dev 注意：价格支付通过 PaymentSBT 合约处理，这里只记录使用次数
     */
    function recordUsage(uint256 agentId) public nonReentrant {
        AgentListing storage listing = listings[agentId];
        require(listing.listed, "AgentStore: Agent not listed");
        
        // 记录使用
        listing.usageCount += 1;
        
        emit AgentUsed(agentId, msg.sender, block.timestamp);
    }

    /**
     * @notice 获取 Agent 完整信息
     * @param agentId Agent ID
     * @return listing 上架信息
     * @return identity 身份信息
     * @return averageRating 平均评分（放大 1000 倍）
     * @return feedbackCount 反馈数量
     */
    function getAgentFullInfo(uint256 agentId) public view returns (
        AgentListing memory listing,
        IdentityRegistry.AgentIdentity memory identity,
        uint256 averageRating,
        uint256 feedbackCount
    ) {
        listing = listings[agentId];
        identity = identityRegistry.getAgentIdentity(agentId);
        (, uint256 avgRating, uint256 count) = reputationRegistry.getReputation(agentId);
        averageRating = avgRating;
        feedbackCount = count;
    }
}

