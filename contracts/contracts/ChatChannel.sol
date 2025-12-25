// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./UserRegistry.sol";

contract ChatChannel {

    // ============ Data Structures ============

    struct Message {
        address profileOwner;   // The profile this message belongs to
        address sender;         // Actual tx sender (could be delegate)
        string content;
        uint256 timestamp;
    }

    enum PostingMode {
        Open,           // Anyone can post
        Permissioned    // Only allowlisted addresses can post
    }

    // ============ State ============

    // External references
    UserRegistry public immutable userRegistry;

    // Metadata
    string public name;
    string public description;
    string public messageOfTheDay;

    // Access control
    address public owner;
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isAllowedPoster;
    PostingMode public postingMode;

    // Messages
    Message[] public messages;

    // ============ Events ============

    event MessagePosted(
        address indexed profileOwner,
        address indexed sender,
        uint256 indexed index,
        uint256 timestamp
    );

    event NameUpdated(string newName);
    event DescriptionUpdated(string newDescription);
    event MessageOfTheDayUpdated(string newMotd);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event AdminPromoted(address indexed admin, address indexed promotedBy);
    event AdminDemoted(address indexed admin, address indexed demotedBy);
    event PosterAdded(address indexed poster, address indexed addedBy);
    event PosterRemoved(address indexed poster, address indexed removedBy);
    event PostingModeChanged(PostingMode newMode, address indexed changedBy);

    // ============ Modifiers ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrAdmin() {
        require(msg.sender == owner || isAdmin[msg.sender], "Not owner or admin");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _userRegistry,
        string memory _name,
        string memory _description,
        PostingMode _postingMode
    ) {
        require(_userRegistry != address(0), "Invalid registry address");
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_name).length <= 100, "Name too long");
        require(bytes(_description).length <= 500, "Description too long");

        userRegistry = UserRegistry(_userRegistry);
        owner = msg.sender;
        name = _name;
        description = _description;
        postingMode = _postingMode;
    }

    // ============ Messaging ============

    function postMessage(string calldata content) external returns (uint256 index) {
        require(bytes(content).length > 0, "Message cannot be empty");
        require(bytes(content).length <= 1000, "Message too long");

        // Check if sender is a delegate for someone (on-chain verification)
        address delegatingOwner = userRegistry.delegateToOwner(msg.sender);

        // If caller is a delegate, use the delegating owner as identity
        // Otherwise, use the caller's address directly (no profile required)
        address profileOwner = delegatingOwner != address(0) ? delegatingOwner : msg.sender;

        // Check posting permissions
        if (postingMode == PostingMode.Permissioned) {
            require(
                profileOwner == owner ||
                isAdmin[profileOwner] ||
                isAllowedPoster[profileOwner],
                "Not allowed to post"
            );
        }

        index = messages.length;
        messages.push(Message({
            profileOwner: profileOwner,
            sender: msg.sender,
            content: content,
            timestamp: block.timestamp
        }));

        emit MessagePosted(profileOwner, msg.sender, index, block.timestamp);
    }

    function getMessage(uint256 index) external view returns (Message memory) {
        require(index < messages.length, "Message does not exist");
        return messages[index];
    }

    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    // Batch fetch for efficiency
    function getMessages(uint256 startIndex, uint256 count) external view returns (Message[] memory) {
        uint256 totalMessages = messages.length;
        if (startIndex >= totalMessages) {
            return new Message[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > totalMessages) {
            endIndex = totalMessages;
        }

        uint256 resultCount = endIndex - startIndex;
        Message[] memory result = new Message[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = messages[startIndex + i];
        }

        return result;
    }

    function getLatestMessages(uint256 count) external view returns (Message[] memory) {
        uint256 totalMessages = messages.length;
        if (count > totalMessages) {
            count = totalMessages;
        }

        if (count == 0) {
            return new Message[](0);
        }

        Message[] memory result = new Message[](count);
        uint256 startIndex = totalMessages - count;

        for (uint256 i = 0; i < count; i++) {
            result[i] = messages[startIndex + i];
        }

        return result;
    }

    // ============ Metadata Management ============

    function setName(string calldata _name) external onlyOwnerOrAdmin {
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_name).length <= 100, "Name too long");

        name = _name;
        emit NameUpdated(_name);
    }

    function setDescription(string calldata _description) external onlyOwnerOrAdmin {
        require(bytes(_description).length <= 500, "Description too long");

        description = _description;
        emit DescriptionUpdated(_description);
    }

    function setMessageOfTheDay(string calldata _motd) external onlyOwnerOrAdmin {
        require(bytes(_motd).length <= 500, "MOTD too long");

        messageOfTheDay = _motd;
        emit MessageOfTheDayUpdated(_motd);
    }

    // ============ Ownership ============

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ============ Admin Management ============

    function promoteAdmin(address admin) external onlyOwnerOrAdmin {
        require(admin != address(0), "Invalid address");
        require(!isAdmin[admin], "Already admin");
        isAdmin[admin] = true;
        emit AdminPromoted(admin, msg.sender);
    }

    function demoteAdmin(address admin) external onlyOwner {
        require(isAdmin[admin], "Not an admin");
        isAdmin[admin] = false;
        emit AdminDemoted(admin, msg.sender);
    }

    // ============ Poster Management ============

    function addAllowedPoster(address poster) external onlyOwnerOrAdmin {
        require(poster != address(0), "Invalid address");
        isAllowedPoster[poster] = true;
        emit PosterAdded(poster, msg.sender);
    }

    function removeAllowedPoster(address poster) external onlyOwnerOrAdmin {
        isAllowedPoster[poster] = false;
        emit PosterRemoved(poster, msg.sender);
    }

    function setPostingMode(PostingMode _mode) external onlyOwnerOrAdmin {
        postingMode = _mode;
        emit PostingModeChanged(_mode, msg.sender);
    }

    // ============ View Functions ============

    function getChannelInfo() external view returns (
        string memory _name,
        string memory _description,
        string memory _motd,
        address _owner,
        PostingMode _postingMode,
        uint256 _messageCount
    ) {
        return (name, description, messageOfTheDay, owner, postingMode, messages.length);
    }
}
