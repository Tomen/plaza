// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../UserRegistry.sol";

/**
 * @title ForumThread
 * @notice Public discussion threads that anyone with a profile can create
 * @dev Threads support user-defined tags, editing, and soft deletion.
 *      Replies are handled by the external Replies contract.
 *      Voting is handled by the external Voting contract.
 */
contract ForumThread {
    struct Thread {
        address author;             // The creator of the thread
        address sender;             // Actual tx signer (could be delegate)
        string title;               // Thread title
        string content;             // Thread body content
        uint256 timestamp;          // Created at
        uint256 editedAt;           // 0 if never edited
        bool isDeleted;             // Soft delete flag
        string[] tags;              // User-defined tags
    }

    Thread[] public threads;

    // author => array of thread indices
    mapping(address => uint256[]) public authorThreadIndices;

    UserRegistry public immutable userRegistry;

    uint256 public constant MAX_TITLE_LENGTH = 200;
    uint256 public constant MAX_CONTENT_LENGTH = 10000;
    uint256 public constant MAX_TAGS = 5;
    uint256 public constant MAX_TAG_LENGTH = 32;

    // Entity type for Replies/Voting contract integration
    uint8 public constant ENTITY_TYPE = 2; // ForumThread = 2

    event ThreadCreated(
        address indexed author,
        address sender,
        uint256 indexed threadIndex,
        uint256 timestamp
    );
    event ThreadEdited(
        address indexed author,
        uint256 indexed threadIndex,
        uint256 editedAt
    );
    event ThreadDeleted(
        address indexed author,
        uint256 indexed threadIndex
    );

    error TitleTooLong();
    error TitleEmpty();
    error ContentTooLong();
    error ContentEmpty();
    error ProfileRequired();
    error ThreadNotFound();
    error ThreadAlreadyDeleted();
    error NotAuthorized();
    error TooManyTags();
    error TagTooLong();

    constructor(address _userRegistry) {
        userRegistry = UserRegistry(_userRegistry);
    }

    /**
     * @notice Create a new thread
     * @param _title The thread title (max 200 chars)
     * @param _content The thread content (max 10000 chars)
     * @param _tags User-defined tags (max 5, each max 32 chars)
     * @return threadIndex The index of the created thread
     */
    function createThread(
        string calldata _title,
        string calldata _content,
        string[] calldata _tags
    ) external returns (uint256) {
        if (bytes(_title).length == 0) revert TitleEmpty();
        if (bytes(_title).length > MAX_TITLE_LENGTH) revert TitleTooLong();
        if (bytes(_content).length == 0) revert ContentEmpty();
        if (bytes(_content).length > MAX_CONTENT_LENGTH) revert ContentTooLong();
        if (_tags.length > MAX_TAGS) revert TooManyTags();

        // Validate each tag length
        for (uint256 i = 0; i < _tags.length; i++) {
            if (bytes(_tags[i]).length > MAX_TAG_LENGTH) revert TagTooLong();
        }

        // Resolve sender to profile owner (delegate support)
        address author = _resolveSender(msg.sender);
        if (!userRegistry.hasProfile(author)) revert ProfileRequired();

        uint256 threadIndex = threads.length;

        // Create thread with empty tags array first
        threads.push();
        Thread storage newThread = threads[threadIndex];
        newThread.author = author;
        newThread.sender = msg.sender;
        newThread.title = _title;
        newThread.content = _content;
        newThread.timestamp = block.timestamp;
        newThread.editedAt = 0;
        newThread.isDeleted = false;

        // Copy tags
        for (uint256 i = 0; i < _tags.length; i++) {
            newThread.tags.push(_tags[i]);
        }

        authorThreadIndices[author].push(threadIndex);

        emit ThreadCreated(author, msg.sender, threadIndex, block.timestamp);

        return threadIndex;
    }

    /**
     * @notice Edit a thread's content (title and tags cannot be changed)
     * @param _threadIndex The index of the thread to edit
     * @param _newContent The new content
     */
    function editThread(uint256 _threadIndex, string calldata _newContent) external {
        if (_threadIndex >= threads.length) revert ThreadNotFound();
        if (bytes(_newContent).length == 0) revert ContentEmpty();
        if (bytes(_newContent).length > MAX_CONTENT_LENGTH) revert ContentTooLong();

        Thread storage thread = threads[_threadIndex];
        if (thread.isDeleted) revert ThreadAlreadyDeleted();

        // Check if sender can act as author
        if (!userRegistry.canActAs(msg.sender, thread.author)) {
            revert NotAuthorized();
        }

        thread.content = _newContent;
        thread.editedAt = block.timestamp;

        emit ThreadEdited(thread.author, _threadIndex, block.timestamp);
    }

    /**
     * @notice Delete a thread (soft delete)
     * @param _threadIndex The index of the thread to delete
     */
    function deleteThread(uint256 _threadIndex) external {
        if (_threadIndex >= threads.length) revert ThreadNotFound();

        Thread storage thread = threads[_threadIndex];
        if (thread.isDeleted) revert ThreadAlreadyDeleted();

        // Check if sender can act as author
        if (!userRegistry.canActAs(msg.sender, thread.author)) {
            revert NotAuthorized();
        }

        thread.title = "";
        thread.content = "";
        // Clear tags
        delete thread.tags;
        thread.isDeleted = true;

        emit ThreadDeleted(thread.author, _threadIndex);
    }

    // Read functions

    /**
     * @notice Get a single thread
     * @param _threadIndex The index of the thread
     */
    function getThread(uint256 _threadIndex) external view returns (Thread memory) {
        if (_threadIndex >= threads.length) revert ThreadNotFound();
        return threads[_threadIndex];
    }

    /**
     * @notice Get tags for a thread
     * @param _threadIndex The index of the thread
     */
    function getThreadTags(uint256 _threadIndex) external view returns (string[] memory) {
        if (_threadIndex >= threads.length) revert ThreadNotFound();
        return threads[_threadIndex].tags;
    }

    /**
     * @notice Get total thread count
     */
    function getThreadCount() external view returns (uint256) {
        return threads.length;
    }

    /**
     * @notice Get thread count for an author
     * @param _author The author address
     */
    function getAuthorThreadCount(address _author) external view returns (uint256) {
        return authorThreadIndices[_author].length;
    }

    /**
     * @notice Get latest threads
     * @param _count Maximum number of threads to return
     */
    function getLatestThreads(uint256 _count) external view returns (Thread[] memory, uint256[] memory) {
        uint256 total = threads.length;

        if (total == 0 || _count == 0) {
            return (new Thread[](0), new uint256[](0));
        }

        uint256 resultCount = _count > total ? total : _count;

        Thread[] memory result = new Thread[](resultCount);
        uint256[] memory indices = new uint256[](resultCount);

        // Return in reverse order (newest first)
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 idx = total - 1 - i;
            result[i] = threads[idx];
            indices[i] = idx;
        }

        return (result, indices);
    }

    /**
     * @notice Get threads by author
     * @param _author The author address
     * @param _count Maximum number of threads to return
     */
    function getLatestThreadsByAuthor(
        address _author,
        uint256 _count
    ) external view returns (Thread[] memory, uint256[] memory) {
        uint256[] storage authIndices = authorThreadIndices[_author];
        uint256 total = authIndices.length;

        if (total == 0 || _count == 0) {
            return (new Thread[](0), new uint256[](0));
        }

        uint256 resultCount = _count > total ? total : _count;

        Thread[] memory result = new Thread[](resultCount);
        uint256[] memory indices = new uint256[](resultCount);

        // Return in reverse order (newest first)
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 threadIndex = authIndices[total - 1 - i];
            result[i] = threads[threadIndex];
            indices[i] = threadIndex;
        }

        return (result, indices);
    }

    /**
     * @notice Get threads paginated
     * @param _startIndex Start index
     * @param _count Maximum number of threads to return
     */
    function getThreads(
        uint256 _startIndex,
        uint256 _count
    ) external view returns (Thread[] memory, uint256[] memory) {
        uint256 total = threads.length;

        if (_startIndex >= total) {
            return (new Thread[](0), new uint256[](0));
        }

        uint256 endIndex = _startIndex + _count;
        if (endIndex > total) {
            endIndex = total;
        }

        uint256 resultCount = endIndex - _startIndex;
        Thread[] memory result = new Thread[](resultCount);
        uint256[] memory indices = new uint256[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 idx = _startIndex + i;
            result[i] = threads[idx];
            indices[i] = idx;
        }

        return (result, indices);
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
