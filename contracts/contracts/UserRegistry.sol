// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserRegistry {

    // ============ Data Structures ============

    struct Link {
        string name;
        string url;
    }

    struct Profile {
        address owner;
        string displayName;
        string bio;
        bool exists;
    }

    // ============ State ============

    // Profile data (owner address => profile)
    mapping(address => Profile) public profiles;

    // Links stored separately (owner => links array)
    mapping(address => Link[]) private profileLinks;

    // Delegate management
    // delegateToOwner: delegate address => profile owner (for reverse lookup)
    mapping(address => address) public delegateToOwner;

    // ownerDelegates: owner => delegate => isActive
    mapping(address => mapping(address => bool)) public isDelegate;

    // Session public keys for ECDH encryption (stored separately due to dynamic bytes)
    mapping(address => bytes) public sessionPublicKeys;

    // ============ Events ============

    event ProfileCreated(address indexed owner);
    event ProfileUpdated(address indexed owner);
    event DisplayNameUpdated(address indexed owner, string newName);
    event BioUpdated(address indexed owner, string newBio);
    event LinkAdded(address indexed owner, uint256 index, string name, string url);
    event LinkRemoved(address indexed owner, uint256 index);
    event LinksCleared(address indexed owner);

    event DelegateAdded(address indexed owner, address indexed delegate);
    event DelegateRemoved(address indexed owner, address indexed delegate);
    event ProfileOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event SessionPublicKeyUpdated(address indexed owner);
    event SessionPublicKeyCleared(address indexed owner);

    // ============ Modifiers ============

    modifier onlyProfileOwner() {
        require(profiles[msg.sender].exists, "Profile does not exist");
        require(profiles[msg.sender].owner == msg.sender, "Not profile owner");
        _;
    }

    modifier profileExists(address owner) {
        require(profiles[owner].exists, "Profile does not exist");
        _;
    }

    // ============ Internal Helpers ============

    /// @dev Resolves msg.sender to profile owner (supports delegates)
    function _resolveSender() internal view returns (address) {
        address owner = delegateToOwner[msg.sender];
        if (owner != address(0)) {
            return owner;
        }
        return msg.sender;
    }

    /// @dev Requires sender to be owner or delegate of an existing profile
    function _requireOwnerOrDelegate() internal view returns (address) {
        address owner = _resolveSender();
        require(profiles[owner].exists, "Profile does not exist");
        return owner;
    }

    // ============ Profile Management ============

    function createProfile(
        string calldata displayName,
        string calldata bio
    ) external {
        require(!profiles[msg.sender].exists, "Profile already exists");
        require(bytes(displayName).length > 0, "Display name required");
        require(bytes(displayName).length <= 50, "Display name too long");
        require(bytes(bio).length <= 500, "Bio too long");

        profiles[msg.sender] = Profile({
            owner: msg.sender,
            displayName: displayName,
            bio: bio,
            exists: true
        });

        emit ProfileCreated(msg.sender);
    }

    /// @notice Creates a profile with an address-derived display name
    function createDefaultProfile() external {
        require(!profiles[msg.sender].exists, "Profile already exists");

        string memory defaultName = _addressToShortString(msg.sender);

        profiles[msg.sender] = Profile({
            owner: msg.sender,
            displayName: defaultName,
            bio: "",
            exists: true
        });

        emit ProfileCreated(msg.sender);
    }

    function _addressToShortString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(10); // "0x" + 8 chars
        str[0] = '0';
        str[1] = 'x';
        uint160 value = uint160(addr);
        for (uint256 i = 9; i >= 2; i--) {
            str[i] = alphabet[value & 0xf];
            value >>= 4;
        }
        return string(str);
    }

    function setDisplayName(string calldata displayName) external onlyProfileOwner {
        require(bytes(displayName).length > 0, "Display name required");
        require(bytes(displayName).length <= 50, "Display name too long");

        profiles[msg.sender].displayName = displayName;
        emit DisplayNameUpdated(msg.sender, displayName);
    }

    function setBio(string calldata bio) external onlyProfileOwner {
        require(bytes(bio).length <= 500, "Bio too long");

        profiles[msg.sender].bio = bio;
        emit BioUpdated(msg.sender, bio);
    }

    // ============ Links Management ============
    // Note: Link operations support delegates for gasless UX

    function addLink(string calldata name, string calldata url) external {
        address owner = _requireOwnerOrDelegate();
        require(bytes(name).length > 0, "Link name required");
        require(bytes(name).length <= 50, "Link name too long");
        require(bytes(url).length > 0, "Link URL required");
        require(bytes(url).length <= 200, "Link URL too long");
        require(profileLinks[owner].length < 10, "Max 10 links");

        uint256 index = profileLinks[owner].length;
        profileLinks[owner].push(Link({name: name, url: url}));
        emit LinkAdded(owner, index, name, url);
    }

    function removeLink(uint256 index) external {
        address owner = _requireOwnerOrDelegate();
        Link[] storage links = profileLinks[owner];
        require(index < links.length, "Index out of bounds");

        // Move last element to deleted position, then pop
        links[index] = links[links.length - 1];
        links.pop();

        emit LinkRemoved(owner, index);
    }

    function clearLinks() external {
        address owner = _requireOwnerOrDelegate();
        delete profileLinks[owner];
        emit LinksCleared(owner);
    }

    function getLinks(address owner) external view returns (Link[] memory) {
        return profileLinks[owner];
    }

    function getLinkCount(address owner) external view returns (uint256) {
        return profileLinks[owner].length;
    }

    // ============ Delegate Management ============

    function addDelegate(address delegate) external onlyProfileOwner {
        require(delegate != address(0), "Invalid delegate address");
        require(delegate != msg.sender, "Cannot delegate to self");
        require(!isDelegate[msg.sender][delegate], "Already a delegate");
        require(delegateToOwner[delegate] == address(0), "Address is delegate for another profile");

        isDelegate[msg.sender][delegate] = true;
        delegateToOwner[delegate] = msg.sender;

        emit DelegateAdded(msg.sender, delegate);
    }

    function removeDelegate(address delegate) external onlyProfileOwner {
        require(isDelegate[msg.sender][delegate], "Not a delegate");

        isDelegate[msg.sender][delegate] = false;
        delegateToOwner[delegate] = address(0);

        emit DelegateRemoved(msg.sender, delegate);
    }

    // ============ Session Public Key Management ============

    /// @notice Set the session public key for ECDH encryption
    /// @param sessionPubKey The uncompressed secp256k1 public key (64 bytes, without 0x04 prefix)
    function setSessionPublicKey(bytes calldata sessionPubKey) external onlyProfileOwner {
        require(sessionPubKey.length == 64, "Invalid public key length");
        sessionPublicKeys[msg.sender] = sessionPubKey;
        emit SessionPublicKeyUpdated(msg.sender);
    }

    /// @notice Clear the session public key
    function clearSessionPublicKey() external onlyProfileOwner {
        delete sessionPublicKeys[msg.sender];
        emit SessionPublicKeyCleared(msg.sender);
    }

    /// @notice Get the session public key for a user
    function getSessionPublicKey(address owner) external view returns (bytes memory) {
        return sessionPublicKeys[owner];
    }

    /// @notice Check if a user has a session public key set
    function hasSessionPublicKey(address owner) external view returns (bool) {
        return sessionPublicKeys[owner].length > 0;
    }

    // ============ Profile Ownership Transfer ============

    /// @notice Transfers profile ownership to a new address
    /// @param newOwner The address to transfer the profile to
    function transferProfileOwnership(address newOwner) external onlyProfileOwner {
        require(newOwner != address(0), "Invalid new owner");
        require(!profiles[newOwner].exists, "New owner has profile");
        require(delegateToOwner[newOwner] == address(0), "New owner is delegate");

        // Copy profile to new owner
        profiles[newOwner] = Profile({
            owner: newOwner,
            displayName: profiles[msg.sender].displayName,
            bio: profiles[msg.sender].bio,
            exists: true
        });

        // Copy links
        Link[] storage oldLinks = profileLinks[msg.sender];
        for (uint256 i = 0; i < oldLinks.length; i++) {
            profileLinks[newOwner].push(oldLinks[i]);
        }

        // Copy session public key if set
        if (sessionPublicKeys[msg.sender].length > 0) {
            sessionPublicKeys[newOwner] = sessionPublicKeys[msg.sender];
        }

        // Delete old profile, links, and session key
        delete profiles[msg.sender];
        delete profileLinks[msg.sender];
        delete sessionPublicKeys[msg.sender];

        emit ProfileOwnershipTransferred(msg.sender, newOwner);
    }

    // ============ Lookup Functions ============

    /// @notice Resolves an address to a profile owner.
    ///         If the address is a delegate, returns the delegating owner.
    ///         If the address has a profile, returns itself.
    ///         Otherwise returns address(0).
    function resolveToOwner(address addr) external view returns (address) {
        // Check if it's a delegate first
        address delegatingOwner = delegateToOwner[addr];
        if (delegatingOwner != address(0)) {
            return delegatingOwner;
        }

        // Check if it's a profile owner
        if (profiles[addr].exists) {
            return addr;
        }

        return address(0);
    }

    /// @notice Check if an address can act on behalf of a profile owner
    function canActAs(address actor, address profileOwner) external view returns (bool) {
        if (actor == profileOwner) return true;
        return isDelegate[profileOwner][actor];
    }

    function getProfile(address owner) external view returns (Profile memory) {
        return profiles[owner];
    }

    function hasProfile(address addr) external view returns (bool) {
        return profiles[addr].exists;
    }
}
