import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("ForumThread", function () {
  let userRegistry;
  let forumThread;
  let owner;
  let user1;
  let user2;
  let delegate;

  beforeEach(async function () {
    [owner, user1, user2, delegate] = await ethers.getSigners();

    // Deploy UserRegistry
    const UserRegistry = await ethers.getContractFactory("UserRegistry");
    userRegistry = await UserRegistry.deploy();

    // Deploy ForumThread
    const ForumThread = await ethers.getContractFactory("ForumThread");
    forumThread = await ForumThread.deploy(await userRegistry.getAddress());

    // Create profiles for testing
    await userRegistry.connect(user1).createProfile("User1", "Bio 1");
    await userRegistry.connect(user2).createProfile("User2", "Bio 2");
  });

  describe("Thread Creation", function () {
    it("should create a thread with tags", async function () {
      const tx = await forumThread.connect(user1).createThread(
        "Test Title",
        "Test Content",
        ["solidity", "web3"]
      );
      await expect(tx).to.emit(forumThread, "ThreadCreated");

      const thread = await forumThread.getThread(0);
      expect(thread.author).to.equal(user1.address);
      expect(thread.title).to.equal("Test Title");
      expect(thread.content).to.equal("Test Content");
      expect(thread.tags).to.deep.equal(["solidity", "web3"]);
      expect(thread.isDeleted).to.be.false;
    });

    it("should create a thread without tags", async function () {
      await forumThread.connect(user1).createThread("No Tags", "Content", []);

      const thread = await forumThread.getThread(0);
      expect(thread.title).to.equal("No Tags");
      expect(thread.tags).to.deep.equal([]);
    });

    it("should reject empty title", async function () {
      await expect(
        forumThread.connect(user1).createThread("", "Test Content", [])
      ).to.be.revertedWithCustomError(forumThread, "TitleEmpty");
    });

    it("should reject empty content", async function () {
      await expect(
        forumThread.connect(user1).createThread("Test Title", "", [])
      ).to.be.revertedWithCustomError(forumThread, "ContentEmpty");
    });

    it("should reject title too long", async function () {
      const longTitle = "a".repeat(201);
      await expect(
        forumThread.connect(user1).createThread(longTitle, "Test Content", [])
      ).to.be.revertedWithCustomError(forumThread, "TitleTooLong");
    });

    it("should reject content too long", async function () {
      const longContent = "a".repeat(10001);
      await expect(
        forumThread.connect(user1).createThread("Test Title", longContent, [])
      ).to.be.revertedWithCustomError(forumThread, "ContentTooLong");
    });

    it("should reject too many tags", async function () {
      const tooManyTags = ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"];
      await expect(
        forumThread.connect(user1).createThread("Title", "Content", tooManyTags)
      ).to.be.revertedWithCustomError(forumThread, "TooManyTags");
    });

    it("should reject tag too long", async function () {
      const longTag = "a".repeat(33);
      await expect(
        forumThread.connect(user1).createThread("Title", "Content", [longTag])
      ).to.be.revertedWithCustomError(forumThread, "TagTooLong");
    });

    it("should reject users without profile", async function () {
      await expect(
        forumThread.connect(owner).createThread("Test Title", "Test Content", [])
      ).to.be.revertedWithCustomError(forumThread, "ProfileRequired");
    });

    it("should allow delegate to create thread", async function () {
      await userRegistry.connect(user1).addDelegate(delegate.address);

      const tx = await forumThread.connect(delegate).createThread(
        "Delegate Thread",
        "Content",
        ["delegate"]
      );
      await expect(tx).to.emit(forumThread, "ThreadCreated");

      const thread = await forumThread.getThread(0);
      expect(thread.author).to.equal(user1.address);
      expect(thread.sender).to.equal(delegate.address);
      expect(thread.tags).to.deep.equal(["delegate"]);
    });

    it("should track threads by author", async function () {
      await forumThread.connect(user1).createThread("Thread 1", "Content", []);
      await forumThread.connect(user1).createThread("Thread 2", "Content", []);
      await forumThread.connect(user2).createThread("Thread 3", "Content", []);

      expect(await forumThread.getAuthorThreadCount(user1.address)).to.equal(2);
      expect(await forumThread.getAuthorThreadCount(user2.address)).to.equal(1);
    });
  });

  describe("Thread Editing", function () {
    beforeEach(async function () {
      await forumThread.connect(user1).createThread(
        "Test Title",
        "Original Content",
        ["test"]
      );
    });

    it("should edit thread content", async function () {
      const tx = await forumThread.connect(user1).editThread(0, "Updated Content");
      await expect(tx).to.emit(forumThread, "ThreadEdited");

      const thread = await forumThread.getThread(0);
      expect(thread.content).to.equal("Updated Content");
      expect(thread.title).to.equal("Test Title"); // Title unchanged
      expect(thread.tags).to.deep.equal(["test"]); // Tags unchanged
      expect(thread.editedAt).to.be.gt(0);
    });

    it("should allow delegate to edit thread", async function () {
      await userRegistry.connect(user1).addDelegate(delegate.address);

      await forumThread.connect(delegate).editThread(0, "Delegate Edit");

      const thread = await forumThread.getThread(0);
      expect(thread.content).to.equal("Delegate Edit");
    });

    it("should reject edit by non-author", async function () {
      await expect(
        forumThread.connect(user2).editThread(0, "Hacked")
      ).to.be.revertedWithCustomError(forumThread, "NotAuthorized");
    });

    it("should reject empty content on edit", async function () {
      await expect(
        forumThread.connect(user1).editThread(0, "")
      ).to.be.revertedWithCustomError(forumThread, "ContentEmpty");
    });

    it("should reject edit of deleted thread", async function () {
      await forumThread.connect(user1).deleteThread(0);
      await expect(
        forumThread.connect(user1).editThread(0, "New Content")
      ).to.be.revertedWithCustomError(forumThread, "ThreadAlreadyDeleted");
    });
  });

  describe("Thread Deletion", function () {
    beforeEach(async function () {
      await forumThread.connect(user1).createThread(
        "Test Title",
        "Test Content",
        ["tag1", "tag2"]
      );
    });

    it("should delete thread and clear tags", async function () {
      await expect(forumThread.connect(user1).deleteThread(0))
        .to.emit(forumThread, "ThreadDeleted")
        .withArgs(user1.address, 0);

      const thread = await forumThread.getThread(0);
      expect(thread.isDeleted).to.be.true;
      expect(thread.title).to.equal("");
      expect(thread.content).to.equal("");
      expect(thread.tags).to.deep.equal([]);
    });

    it("should allow delegate to delete thread", async function () {
      await userRegistry.connect(user1).addDelegate(delegate.address);

      await forumThread.connect(delegate).deleteThread(0);

      const thread = await forumThread.getThread(0);
      expect(thread.isDeleted).to.be.true;
    });

    it("should reject delete by non-author", async function () {
      await expect(
        forumThread.connect(user2).deleteThread(0)
      ).to.be.revertedWithCustomError(forumThread, "NotAuthorized");
    });

    it("should reject double delete", async function () {
      await forumThread.connect(user1).deleteThread(0);
      await expect(
        forumThread.connect(user1).deleteThread(0)
      ).to.be.revertedWithCustomError(forumThread, "ThreadAlreadyDeleted");
    });
  });

  describe("Thread Retrieval", function () {
    beforeEach(async function () {
      // Create multiple threads with various tags
      await forumThread.connect(user1).createThread("Thread 1", "Content", ["javascript"]);
      await forumThread.connect(user1).createThread("Thread 2", "Content", ["rust", "systems"]);
      await forumThread.connect(user2).createThread("Thread 3", "Content", []);
      await forumThread.connect(user1).createThread("Thread 4", "Content", ["web3"]);
    });

    it("should get thread count", async function () {
      expect(await forumThread.getThreadCount()).to.equal(4);
    });

    it("should get latest threads", async function () {
      const [threads, indices] = await forumThread.getLatestThreads(2);
      expect(threads.length).to.equal(2);
      expect(threads[0].title).to.equal("Thread 4"); // Newest first
      expect(threads[1].title).to.equal("Thread 3");
      expect(indices[0]).to.equal(3);
      expect(indices[1]).to.equal(2);
    });

    it("should get threads by author", async function () {
      const [threads, indices] = await forumThread.getLatestThreadsByAuthor(user1.address, 10);
      expect(threads.length).to.equal(3);
      expect(threads[0].title).to.equal("Thread 4");
      expect(threads[1].title).to.equal("Thread 2");
      expect(threads[2].title).to.equal("Thread 1");
    });

    it("should get threads paginated", async function () {
      const [threads, indices] = await forumThread.getThreads(1, 2);
      expect(threads.length).to.equal(2);
      expect(threads[0].title).to.equal("Thread 2"); // Index 1
      expect(threads[1].title).to.equal("Thread 3"); // Index 2
    });

    it("should get thread tags", async function () {
      const tags = await forumThread.getThreadTags(1);
      expect(tags).to.deep.equal(["rust", "systems"]);
    });

    it("should handle empty results", async function () {
      const [threads] = await forumThread.getLatestThreadsByAuthor(owner.address, 10);
      expect(threads.length).to.equal(0);
    });
  });

  describe("Constants", function () {
    it("should have correct entity type", async function () {
      expect(await forumThread.ENTITY_TYPE()).to.equal(2);
    });

    it("should have correct max lengths", async function () {
      expect(await forumThread.MAX_TITLE_LENGTH()).to.equal(200);
      expect(await forumThread.MAX_CONTENT_LENGTH()).to.equal(10000);
      expect(await forumThread.MAX_TAGS()).to.equal(5);
      expect(await forumThread.MAX_TAG_LENGTH()).to.equal(32);
    });
  });
});
