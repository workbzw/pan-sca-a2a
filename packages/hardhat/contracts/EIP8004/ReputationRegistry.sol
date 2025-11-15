//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationRegistry
 * @notice EIP-8004 声誉注册表
 * @dev 管理 Agent 的声誉、评分和反馈
 * @dev 使用 OpenZeppelin ReentrancyGuard 防止重入攻击
 */
contract ReputationRegistry is ReentrancyGuard {
    struct Feedback {
        address reviewer;        // 评价者地址
        uint8 rating;            // 评分 (1-5)
        string comment;          // 评价内容
        uint256 timestamp;       // 评价时间
    }

    struct ReputationScore {
        uint256 totalRatings;    // 总评价数
        uint256 sumRatings;      // 评分总和
        uint256 averageRating;   // 平均评分（以 1000 为单位，例如 3500 = 3.5）
        uint256 feedbackCount;   // 反馈数量
    }

    // Agent ID => Reputation Score
    mapping(uint256 => ReputationScore) public reputations;
    
    // Agent ID => Feedback[]
    mapping(uint256 => Feedback[]) public feedbacks;
    
    // Agent ID => Reviewer => 是否已评价
    mapping(uint256 => mapping(address => bool)) public hasReviewed;

    // 事件
    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 rating,
        string comment,
        uint256 timestamp
    );

    /**
     * @notice 提交对 Agent 的反馈
     * @param agentId Agent ID
     * @param rating 评分 (1-5)
     * @param comment 评价内容
     * @dev 使用 nonReentrant 防止重入攻击
     */
    function submitFeedback(
        uint256 agentId,
        uint8 rating,
        string memory comment
    ) public nonReentrant {
        require(rating >= 1 && rating <= 5, "ReputationRegistry: Invalid rating");
        require(!hasReviewed[agentId][msg.sender], "ReputationRegistry: Already reviewed");
        
        ReputationScore storage reputation = reputations[agentId];
        
        // 更新声誉评分
        reputation.totalRatings += 1;
        reputation.sumRatings += rating;
        reputation.averageRating = (reputation.sumRatings * 1000) / reputation.totalRatings;
        reputation.feedbackCount += 1;
        
        // 添加反馈
        feedbacks[agentId].push(Feedback({
            reviewer: msg.sender,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp
        }));
        
        hasReviewed[agentId][msg.sender] = true;
        
        emit FeedbackSubmitted(agentId, msg.sender, rating, comment, block.timestamp);
    }

    /**
     * @notice 获取 Agent 的声誉评分
     * @param agentId Agent ID
     * @return totalRatings 总评价数
     * @return averageRating 平均评分（放大 1000 倍）
     * @return feedbackCount 反馈数量
     */
    function getReputation(uint256 agentId) public view returns (
        uint256 totalRatings,
        uint256 averageRating,
        uint256 feedbackCount
    ) {
        ReputationScore memory reputation = reputations[agentId];
        return (
            reputation.totalRatings,
            reputation.averageRating,
            reputation.feedbackCount
        );
    }

    /**
     * @notice 获取 Agent 的所有反馈
     * @param agentId Agent ID
     * @return feedbacksArray 反馈数组
     */
    function getFeedbacks(uint256 agentId) public view returns (Feedback[] memory feedbacksArray) {
        return feedbacks[agentId];
    }

    /**
     * @notice 获取 Agent 的平均评分（1-5）
     * @param agentId Agent ID
     * @return rating 平均评分（浮点数表示，例如 3500 = 3.5）
     */
    function getAverageRating(uint256 agentId) public view returns (uint256 rating) {
        return reputations[agentId].averageRating;
    }
}

