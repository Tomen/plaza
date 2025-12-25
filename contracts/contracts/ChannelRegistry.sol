// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ChatChannel.sol";
import "./UserRegistry.sol";

contract ChannelRegistry {

    // ============ Data Structures ============

    struct ChannelInfo {
        address channelAddress;
        address registeredBy;
        uint256 registeredAt;
    }

    // ============ State ============

    UserRegistry public immutable userRegistry;

    ChannelInfo[] public channels;
    mapping(address => bool) public isRegistered;
    mapping(address => uint256[]) public channelsByCreator;

    // ============ Events ============

    event ChannelRegistered(
        address indexed channelAddress,
        address indexed registeredBy,
        uint256 indexed index
    );

    event ChannelCreated(
        address indexed channelAddress,
        address indexed creator,
        uint256 indexed registryIndex
    );

    // ============ Constructor ============

    constructor(address _userRegistry) {
        require(_userRegistry != address(0), "Invalid registry address");
        userRegistry = UserRegistry(_userRegistry);
    }

    // ============ Registration ============

    function registerChannel(address channelAddress) external returns (uint256 index) {
        require(channelAddress != address(0), "Invalid address");
        require(!isRegistered[channelAddress], "Already registered");

        index = channels.length;
        channels.push(ChannelInfo({
            channelAddress: channelAddress,
            registeredBy: msg.sender,
            registeredAt: block.timestamp
        }));

        isRegistered[channelAddress] = true;
        channelsByCreator[msg.sender].push(index);

        emit ChannelRegistered(channelAddress, msg.sender, index);
    }

    // ============ Factory ============

    function createChannel(
        string calldata _name,
        string calldata _description,
        ChatChannel.PostingMode _postingMode
    ) external returns (address channelAddress, uint256 registryIndex) {
        ChatChannel channel = new ChatChannel(
            address(userRegistry),
            _name,
            _description,
            _postingMode
        );
        channel.transferOwnership(msg.sender);

        channelAddress = address(channel);

        // Register the channel
        registryIndex = channels.length;
        channels.push(ChannelInfo({
            channelAddress: channelAddress,
            registeredBy: msg.sender,
            registeredAt: block.timestamp
        }));

        isRegistered[channelAddress] = true;
        channelsByCreator[msg.sender].push(registryIndex);

        emit ChannelCreated(channelAddress, msg.sender, registryIndex);
        emit ChannelRegistered(channelAddress, msg.sender, registryIndex);
    }

    // ============ Queries ============

    function getChannelCount() external view returns (uint256) {
        return channels.length;
    }

    function getChannel(uint256 index) external view returns (ChannelInfo memory) {
        require(index < channels.length, "Index out of bounds");
        return channels[index];
    }

    function getChannelsByCreator(address creator) external view returns (uint256[] memory) {
        return channelsByCreator[creator];
    }

    function getChannels(uint256 startIndex, uint256 count) external view returns (ChannelInfo[] memory) {
        uint256 total = channels.length;
        if (startIndex >= total) {
            return new ChannelInfo[](0);
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > total) {
            endIndex = total;
        }

        uint256 resultCount = endIndex - startIndex;
        ChannelInfo[] memory result = new ChannelInfo[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = channels[startIndex + i];
        }

        return result;
    }

    function getAllChannels() external view returns (ChannelInfo[] memory) {
        return channels;
    }
}
