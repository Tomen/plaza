// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../UserRegistry.sol";

/**
 * @title UserPosts
 * @notice Allows users to create posts on their own profile
 * @dev Posts are editable and soft-deletable. Delegates can post for profile owners.
 *      Replies are handled by the external Replies contract.
 */
contract UserPosts {
    struct Post {
        address profileOwner;       // The profile this post belongs to
        address sender;             // Actual tx signer (could be delegate)
        string content;             // Post content
        uint256 timestamp;          // Created at
        uint256 editedAt;           // 0 if never edited
        bool isDeleted;             // Soft delete flag
    }

    Post[] public posts;

    // profileOwner => array of post indices
    mapping(address => uint256[]) public userPostIndices;

    UserRegistry public immutable userRegistry;

    uint256 public constant MAX_CONTENT_LENGTH = 40000;

    // Entity type for Replies contract integration
    uint8 public constant ENTITY_TYPE = 0; // UserPost = 0

    event PostCreated(
        address indexed profileOwner,
        address sender,
        uint256 indexed postIndex,
        uint256 timestamp
    );
    event PostEdited(
        address indexed profileOwner,
        uint256 indexed postIndex,
        uint256 editedAt
    );
    event PostDeleted(
        address indexed profileOwner,
        uint256 indexed postIndex
    );

    error ContentTooLong();
    error ContentEmpty();
    error ProfileRequired();
    error PostNotFound();
    error PostAlreadyDeleted();
    error NotAuthorized();

    constructor(address _userRegistry) {
        userRegistry = UserRegistry(_userRegistry);
    }

    /**
     * @notice Create a new post
     * @param _content The post content (max 2000 chars)
     * @return postIndex The index of the created post
     */
    function createPost(string calldata _content) external returns (uint256) {
        if (bytes(_content).length == 0) revert ContentEmpty();
        if (bytes(_content).length > MAX_CONTENT_LENGTH) revert ContentTooLong();

        // Resolve sender to profile owner (delegate support)
        address profileOwner = _resolveSender(msg.sender);
        if (!userRegistry.hasProfile(profileOwner)) revert ProfileRequired();

        uint256 postIndex = posts.length;
        posts.push(Post({
            profileOwner: profileOwner,
            sender: msg.sender,
            content: _content,
            timestamp: block.timestamp,
            editedAt: 0,
            isDeleted: false
        }));

        userPostIndices[profileOwner].push(postIndex);

        emit PostCreated(profileOwner, msg.sender, postIndex, block.timestamp);

        return postIndex;
    }

    /**
     * @notice Edit a post
     * @param _postIndex The index of the post to edit
     * @param _newContent The new content
     */
    function editPost(uint256 _postIndex, string calldata _newContent) external {
        if (_postIndex >= posts.length) revert PostNotFound();
        if (bytes(_newContent).length == 0) revert ContentEmpty();
        if (bytes(_newContent).length > MAX_CONTENT_LENGTH) revert ContentTooLong();

        Post storage post = posts[_postIndex];
        if (post.isDeleted) revert PostAlreadyDeleted();

        // Check if sender can act as profile owner
        if (!userRegistry.canActAs(msg.sender, post.profileOwner)) {
            revert NotAuthorized();
        }

        post.content = _newContent;
        post.editedAt = block.timestamp;

        emit PostEdited(post.profileOwner, _postIndex, block.timestamp);
    }

    /**
     * @notice Delete a post (soft delete)
     * @param _postIndex The index of the post to delete
     */
    function deletePost(uint256 _postIndex) external {
        if (_postIndex >= posts.length) revert PostNotFound();

        Post storage post = posts[_postIndex];
        if (post.isDeleted) revert PostAlreadyDeleted();

        // Check if sender can act as profile owner
        if (!userRegistry.canActAs(msg.sender, post.profileOwner)) {
            revert NotAuthorized();
        }

        post.content = "";
        post.isDeleted = true;

        emit PostDeleted(post.profileOwner, _postIndex);
    }

    // Read functions

    /**
     * @notice Get a single post
     * @param _postIndex The index of the post
     */
    function getPost(uint256 _postIndex) external view returns (Post memory) {
        if (_postIndex >= posts.length) revert PostNotFound();
        return posts[_postIndex];
    }

    /**
     * @notice Get total post count
     */
    function getPostCount() external view returns (uint256) {
        return posts.length;
    }

    /**
     * @notice Get post count for a user
     * @param user The profile owner address
     */
    function getUserPostCount(address user) external view returns (uint256) {
        return userPostIndices[user].length;
    }

    /**
     * @notice Get posts by a user (paginated)
     * @param user The profile owner address
     * @param startIndex Start index in the user's post list
     * @param count Maximum number of posts to return
     */
    function getUserPosts(
        address user,
        uint256 startIndex,
        uint256 count
    ) external view returns (Post[] memory, uint256[] memory) {
        uint256[] storage indices = userPostIndices[user];
        uint256 total = indices.length;

        if (startIndex >= total) {
            return (new Post[](0), new uint256[](0));
        }

        uint256 endIndex = startIndex + count;
        if (endIndex > total) {
            endIndex = total;
        }

        uint256 resultCount = endIndex - startIndex;
        Post[] memory result = new Post[](resultCount);
        uint256[] memory postIndices = new uint256[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 postIndex = indices[startIndex + i];
            result[i] = posts[postIndex];
            postIndices[i] = postIndex;
        }

        return (result, postIndices);
    }

    /**
     * @notice Get latest posts by a user
     * @param user The profile owner address
     * @param count Maximum number of posts to return
     */
    function getLatestUserPosts(
        address user,
        uint256 count
    ) external view returns (Post[] memory, uint256[] memory) {
        uint256[] storage indices = userPostIndices[user];
        uint256 total = indices.length;

        if (total == 0 || count == 0) {
            return (new Post[](0), new uint256[](0));
        }

        uint256 resultCount = count > total ? total : count;

        Post[] memory result = new Post[](resultCount);
        uint256[] memory postIndices = new uint256[](resultCount);

        // Return in reverse order (newest first)
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 postIndex = indices[total - 1 - i];
            result[i] = posts[postIndex];
            postIndices[i] = postIndex;
        }

        return (result, postIndices);
    }

    /**
     * @notice Get global latest posts (across all users)
     * @param count Maximum number of posts to return
     */
    function getLatestPosts(uint256 count) external view returns (Post[] memory) {
        uint256 total = posts.length;

        if (total == 0 || count == 0) {
            return new Post[](0);
        }

        uint256 resultCount = count > total ? total : count;

        Post[] memory result = new Post[](resultCount);

        // Return in reverse order (newest first)
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = posts[total - 1 - i];
        }

        return result;
    }

    // Internal functions

    function _resolveSender(address sender) internal view returns (address) {
        address delegatingOwner = userRegistry.delegateToOwner(sender);
        if (delegatingOwner != address(0)) {
            return delegatingOwner;
        }
        return sender;
    }
}
