import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("UserRegistry", function () {
  let userRegistry;
  let owner;
  let addr1;
  let addr2;
  let delegate;

  beforeEach(async function () {
    [owner, addr1, addr2, delegate] = await ethers.getSigners();
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();
  });

  describe("Profile Creation", function () {
    it("Should create a profile successfully", async function () {
      await expect(userRegistry.createProfile("Alice", "Hello world"))
        .to.emit(userRegistry, "ProfileCreated")
        .withArgs(owner.address);

      const profile = await userRegistry.getProfile(owner.address);
      expect(profile.displayName).to.equal("Alice");
      expect(profile.bio).to.equal("Hello world");
      expect(profile.exists).to.be.true;
    });

    it("Should reject empty display name", async function () {
      await expect(userRegistry.createProfile("", "Bio"))
        .to.be.revertedWith("Display name required");
    });

    it("Should reject display name too long", async function () {
      const longName = "a".repeat(51);
      await expect(userRegistry.createProfile(longName, "Bio"))
        .to.be.revertedWith("Display name too long");
    });

    it("Should reject bio too long", async function () {
      const longBio = "a".repeat(501);
      await expect(userRegistry.createProfile("Alice", longBio))
        .to.be.revertedWith("Bio too long");
    });

    it("Should reject duplicate profile creation", async function () {
      await userRegistry.createProfile("Alice", "Bio");
      await expect(userRegistry.createProfile("Alice2", "Bio2"))
        .to.be.revertedWith("Profile already exists");
    });

    it("Should check hasProfile correctly", async function () {
      expect(await userRegistry.hasProfile(owner.address)).to.be.false;
      await userRegistry.createProfile("Alice", "Bio");
      expect(await userRegistry.hasProfile(owner.address)).to.be.true;
    });
  });

  describe("Profile Updates", function () {
    beforeEach(async function () {
      await userRegistry.createProfile("Alice", "Hello world");
    });

    it("Should update display name", async function () {
      await expect(userRegistry.setDisplayName("NewAlice"))
        .to.emit(userRegistry, "DisplayNameUpdated")
        .withArgs(owner.address, "NewAlice");

      const profile = await userRegistry.getProfile(owner.address);
      expect(profile.displayName).to.equal("NewAlice");
    });

    it("Should update bio", async function () {
      await expect(userRegistry.setBio("New bio"))
        .to.emit(userRegistry, "BioUpdated")
        .withArgs(owner.address, "New bio");

      const profile = await userRegistry.getProfile(owner.address);
      expect(profile.bio).to.equal("New bio");
    });

    it("Should reject update from non-owner", async function () {
      await expect(userRegistry.connect(addr1).setDisplayName("Hacker"))
        .to.be.revertedWith("Profile does not exist");
    });
  });

  describe("Links Management", function () {
    beforeEach(async function () {
      await userRegistry.createProfile("Alice", "Hello world");
    });

    it("Should add a link", async function () {
      await expect(userRegistry.addLink("Twitter", "https://twitter.com/alice"))
        .to.emit(userRegistry, "LinkAdded")
        .withArgs(owner.address, 0, "Twitter", "https://twitter.com/alice");

      const links = await userRegistry.getLinks(owner.address);
      expect(links.length).to.equal(1);
      expect(links[0].name).to.equal("Twitter");
      expect(links[0].url).to.equal("https://twitter.com/alice");
    });

    it("Should add multiple links", async function () {
      await userRegistry.addLink("Twitter", "https://twitter.com/alice");
      await userRegistry.addLink("GitHub", "https://github.com/alice");

      const count = await userRegistry.getLinkCount(owner.address);
      expect(count).to.equal(2);
    });

    it("Should remove a link", async function () {
      await userRegistry.addLink("Twitter", "https://twitter.com/alice");
      await userRegistry.addLink("GitHub", "https://github.com/alice");

      await expect(userRegistry.removeLink(0))
        .to.emit(userRegistry, "LinkRemoved")
        .withArgs(owner.address, 0);

      const links = await userRegistry.getLinks(owner.address);
      expect(links.length).to.equal(1);
      expect(links[0].name).to.equal("GitHub");
    });

    it("Should clear all links", async function () {
      await userRegistry.addLink("Twitter", "https://twitter.com/alice");
      await userRegistry.addLink("GitHub", "https://github.com/alice");

      await expect(userRegistry.clearLinks())
        .to.emit(userRegistry, "LinksCleared")
        .withArgs(owner.address);

      const links = await userRegistry.getLinks(owner.address);
      expect(links.length).to.equal(0);
    });

    it("Should reject more than 10 links", async function () {
      for (let i = 0; i < 10; i++) {
        await userRegistry.addLink(`Link${i}`, `https://example.com/${i}`);
      }
      await expect(userRegistry.addLink("Link10", "https://example.com/10"))
        .to.be.revertedWith("Max 10 links");
    });
  });

  describe("Delegate Management", function () {
    beforeEach(async function () {
      await userRegistry.createProfile("Alice", "Hello world");
    });

    it("Should add a delegate", async function () {
      await expect(userRegistry.addDelegate(delegate.address))
        .to.emit(userRegistry, "DelegateAdded")
        .withArgs(owner.address, delegate.address);

      expect(await userRegistry.isDelegate(owner.address, delegate.address)).to.be.true;
      expect(await userRegistry.delegateToOwner(delegate.address)).to.equal(owner.address);
    });

    it("Should remove a delegate", async function () {
      await userRegistry.addDelegate(delegate.address);

      await expect(userRegistry.removeDelegate(delegate.address))
        .to.emit(userRegistry, "DelegateRemoved")
        .withArgs(owner.address, delegate.address);

      expect(await userRegistry.isDelegate(owner.address, delegate.address)).to.be.false;
      expect(await userRegistry.delegateToOwner(delegate.address)).to.equal(ethers.ZeroAddress);
    });

    it("Should reject self-delegation", async function () {
      await expect(userRegistry.addDelegate(owner.address))
        .to.be.revertedWith("Cannot delegate to self");
    });

    it("Should reject duplicate delegate", async function () {
      await userRegistry.addDelegate(delegate.address);
      await expect(userRegistry.addDelegate(delegate.address))
        .to.be.revertedWith("Already a delegate");
    });

    it("Should reject delegate already assigned to another profile", async function () {
      await userRegistry.addDelegate(delegate.address);

      await userRegistry.connect(addr1).createProfile("Bob", "Hi");
      await expect(userRegistry.connect(addr1).addDelegate(delegate.address))
        .to.be.revertedWith("Address is delegate for another profile");
    });
  });

  describe("Lookup Functions", function () {
    beforeEach(async function () {
      await userRegistry.createProfile("Alice", "Hello world");
      await userRegistry.addDelegate(delegate.address);
    });

    it("Should resolve owner to themselves", async function () {
      expect(await userRegistry.resolveToOwner(owner.address)).to.equal(owner.address);
    });

    it("Should resolve delegate to owner", async function () {
      expect(await userRegistry.resolveToOwner(delegate.address)).to.equal(owner.address);
    });

    it("Should return zero address for unknown address", async function () {
      expect(await userRegistry.resolveToOwner(addr2.address)).to.equal(ethers.ZeroAddress);
    });

    it("Should check canActAs correctly", async function () {
      expect(await userRegistry.canActAs(owner.address, owner.address)).to.be.true;
      expect(await userRegistry.canActAs(delegate.address, owner.address)).to.be.true;
      expect(await userRegistry.canActAs(addr2.address, owner.address)).to.be.false;
    });
  });

  describe("Default Profile Creation", function () {
    it("Should create profile with address-derived name", async function () {
      await expect(userRegistry.createDefaultProfile())
        .to.emit(userRegistry, "ProfileCreated")
        .withArgs(owner.address);

      const profile = await userRegistry.getProfile(owner.address);
      expect(profile.exists).to.be.true;
      // Display name should be "0x" + first 8 hex chars of address
      expect(profile.displayName).to.match(/^0x[a-f0-9]{8}$/i);
      expect(profile.bio).to.equal("");
    });

    it("Should reject if profile already exists", async function () {
      await userRegistry.createProfile("Alice", "Bio");
      await expect(userRegistry.createDefaultProfile())
        .to.be.revertedWith("Profile already exists");
    });

    it("Should allow updating name after default profile creation", async function () {
      await userRegistry.createDefaultProfile();
      await userRegistry.setDisplayName("Alice");

      const profile = await userRegistry.getProfile(owner.address);
      expect(profile.displayName).to.equal("Alice");
    });
  });

  describe("Profile Ownership Transfer", function () {
    beforeEach(async function () {
      await userRegistry.createProfile("Alice", "Original bio");
      await userRegistry.addLink("Twitter", "https://twitter.com/alice");
    });

    it("Should transfer ownership successfully", async function () {
      await expect(userRegistry.transferProfileOwnership(addr1.address))
        .to.emit(userRegistry, "ProfileOwnershipTransferred")
        .withArgs(owner.address, addr1.address);

      // Check new owner has the profile
      const newProfile = await userRegistry.getProfile(addr1.address);
      expect(newProfile.exists).to.be.true;
      expect(newProfile.displayName).to.equal("Alice");
      expect(newProfile.bio).to.equal("Original bio");

      // Check links transferred
      const links = await userRegistry.getLinks(addr1.address);
      expect(links.length).to.equal(1);
      expect(links[0].name).to.equal("Twitter");

      // Check old owner no longer has profile
      const oldProfile = await userRegistry.getProfile(owner.address);
      expect(oldProfile.exists).to.be.false;

      // Check old owner has no links
      const oldLinks = await userRegistry.getLinks(owner.address);
      expect(oldLinks.length).to.equal(0);
    });

    it("Should reject transfer to zero address", async function () {
      await expect(userRegistry.transferProfileOwnership(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid new owner");
    });

    it("Should reject transfer to address with existing profile", async function () {
      await userRegistry.connect(addr1).createProfile("Bob", "Bio");
      await expect(userRegistry.transferProfileOwnership(addr1.address))
        .to.be.revertedWith("New owner has profile");
    });

    it("Should reject transfer to a delegate of another profile", async function () {
      await userRegistry.connect(addr1).createProfile("Bob", "Bio");
      await userRegistry.connect(addr1).addDelegate(addr2.address);

      await expect(userRegistry.transferProfileOwnership(addr2.address))
        .to.be.revertedWith("New owner is delegate");
    });

    it("Should reject transfer from non-profile-owner", async function () {
      await expect(userRegistry.connect(addr1).transferProfileOwnership(addr2.address))
        .to.be.revertedWith("Profile does not exist");
    });

    it("Should transfer profile with multiple links", async function () {
      await userRegistry.addLink("GitHub", "https://github.com/alice");
      await userRegistry.addLink("Website", "https://alice.dev");

      await userRegistry.transferProfileOwnership(addr1.address);

      const links = await userRegistry.getLinks(addr1.address);
      expect(links.length).to.equal(3);
    });
  });
});
