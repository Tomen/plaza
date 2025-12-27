import { useState, useEffect, useCallback } from 'react';
import type { UserPost, VoteType, VoteTally, Profile } from '../types/contracts';
import { VotingWidget } from './VotingWidget';
import { ReplyThread } from './ReplyThread';
import { UserLink } from './UserAddress';
import { formatTimestamp } from '../utils/formatters';
import type { Provider, Signer } from '../utils/contracts';
import { EntityType } from '../hooks/useVoting';
import toast from 'react-hot-toast';

const PREVIEW_LENGTH = 300;

interface PostCardProps {
  post: UserPost;
  userPostsAddress: string | null;
  repliesAddress: string | null;
  votingAddress: string | null;
  provider: Provider | null;
  signer?: Signer | null;
  currentAddress: string | null;
  // Voting functions
  computeEntityId: (contractAddress: string, entityType: EntityType, entityIndex: number) => Promise<string>;
  getVoteTally: (entityId: string) => Promise<VoteTally>;
  getUserVote: (entityId: string) => Promise<VoteType>;
  vote: (entityId: string, voteType: VoteType) => Promise<void>;
  removeVote: (entityId: string) => Promise<void>;
  isVoting: boolean;
  // Actions
  onEdit?: (postIndex: number, newContent: string) => Promise<void>;
  onDelete?: (postIndex: number) => Promise<void>;
  onSelectUser?: (address: string) => void;
  onSelectPost?: (postIndex: number) => void;
  getDisplayName?: (address: string) => Promise<string>;
  disabled?: boolean;
  // Tooltip props
  getProfile?: (address: string) => Promise<Profile>;
  onStartDM?: (address: string) => void;
  canSendDM?: boolean;
  onFollow?: (address: string) => Promise<void>;
  onUnfollow?: (address: string) => Promise<void>;
  isFollowing?: (address: string) => boolean;
  onTip?: (address: string) => void;
  canTip?: boolean;
}


export function PostCard({
  post,
  userPostsAddress,
  repliesAddress,
  votingAddress,
  provider,
  signer,
  currentAddress,
  computeEntityId,
  getVoteTally,
  getUserVote,
  vote,
  removeVote,
  isVoting,
  onEdit,
  onDelete,
  onSelectUser,
  onSelectPost,
  getDisplayName,
  disabled = false,
  // Tooltip props
  getProfile,
  onStartDM,
  canSendDM = false,
  onFollow,
  onUnfollow,
  isFollowing,
  onTip,
  canTip = false,
}: PostCardProps) {
  const [entityId, setEntityId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReplies, setShowReplies] = useState(false);

  const isOwner = currentAddress?.toLowerCase() === post.profileOwner.toLowerCase();
  const isDelegate = post.sender.toLowerCase() !== post.profileOwner.toLowerCase();

  // Compute entity ID for voting
  const loadEntityId = useCallback(async () => {
    if (!userPostsAddress) return;
    try {
      const id = await computeEntityId(userPostsAddress, EntityType.UserPost, post.index);
      setEntityId(id);
    } catch (err) {
      console.error('Failed to compute entity ID:', err);
    }
  }, [userPostsAddress, post.index, computeEntityId]);

  useEffect(() => {
    loadEntityId();
  }, [loadEntityId]);

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await onEdit?.(post.index, editContent);
      setIsEditing(false);
      toast.success('Post updated');
    } catch (error) {
      console.error('Failed to edit post:', error);
      toast.error('Failed to update post');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete?.(post.index);
      toast.success('Post deleted');
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('Failed to delete post');
      setIsDeleting(false);
    }
  };

  if (post.isDeleted) {
    return (
      <div className="border border-primary-800 bg-black p-4 font-mono">
        <span className="text-primary-700 italic">[POST DELETED]</span>
      </div>
    );
  }

  return (
    <div className="border border-primary-700 bg-black p-4 hover:border-primary-500 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 font-mono text-xs mb-3">
        {onSelectUser && (
          <UserLink
            address={post.profileOwner}
            displayName={post.displayName}
            onSelectUser={onSelectUser}
            isDelegate={isDelegate}
            size="xs"
            getProfile={getProfile}
            provider={provider}
            onStartDM={onStartDM}
            canSendDM={canSendDM}
            onFollow={onFollow}
            onUnfollow={onUnfollow}
            isFollowing={isFollowing?.(post.profileOwner)}
            onTip={onTip}
            canTip={canTip}
          />
        )}
        <span className="text-primary-600">
          {formatTimestamp(post.timestamp)}
        </span>
        {post.editedAt && (
          <span className="text-primary-700 italic">(edited)</span>
        )}
        <span className="text-primary-700 ml-auto">#{post.index}</span>
      </div>

      {/* Content or Edit Form */}
      {isEditing ? (
        <div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[80px] px-3 py-2 bg-black border border-primary-600 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 resize-y"
            maxLength={40000}
            disabled={isSaving}
          />
          <div className="text-xs font-mono text-primary-600 mt-1">
            {editContent.length.toLocaleString()} / 40,000
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={isSaving || !editContent.trim()}
              className="px-4 py-1.5 text-xs font-mono text-primary-400 border border-primary-500 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'SAVING...' : 'SAVE'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setEditContent(post.content);
              }}
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-mono text-primary-600 border border-primary-700 hover:border-primary-500"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className="text-sm text-primary-300 font-mono whitespace-pre-wrap">
            {post.content.length > PREVIEW_LENGTH
              ? post.content.slice(0, PREVIEW_LENGTH) + '...'
              : post.content}
          </div>
          {post.content.length > PREVIEW_LENGTH && onSelectPost && (
            <button
              onClick={() => onSelectPost(post.index)}
              className="mt-2 text-xs font-mono text-primary-500 hover:text-primary-400"
            >
              READ MORE &rarr;
            </button>
          )}
        </div>
      )}

      {/* Actions Row */}
      {!isEditing && (
        <div className="flex items-center gap-4 pt-3 border-t border-primary-800">
          {/* Voting */}
          {entityId && (
            <VotingWidget
              entityId={entityId}
              getVoteTally={getVoteTally}
              getUserVote={getUserVote}
              vote={vote}
              removeVote={removeVote}
              isVoting={isVoting}
              disabled={disabled}
              compact
            />
          )}

          {/* Reply toggle */}
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="text-xs font-mono text-primary-600 hover:text-primary-400"
          >
            {showReplies ? '[-] HIDE REPLIES' : '[+] REPLIES'}
          </button>

          {/* Edit/Delete for owner */}
          {isOwner && !disabled && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs font-mono text-primary-600 hover:text-primary-400 ml-auto"
              >
                EDIT
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs font-mono text-red-600 hover:text-red-400 disabled:opacity-50"
              >
                {isDeleting ? 'DELETING...' : 'DELETE'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Reply Thread */}
      {showReplies && (
        <ReplyThread
          repliesAddress={repliesAddress}
          votingAddress={votingAddress}
          userPostsAddress={userPostsAddress}
          postIndex={post.index}
          provider={provider}
          signer={signer}
          currentAddress={currentAddress}
          getDisplayName={getDisplayName}
          onSelectUser={onSelectUser}
          disabled={disabled}
          getProfile={getProfile}
          onStartDM={onStartDM}
          canSendDM={canSendDM}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          isFollowing={isFollowing}
          onTip={onTip}
          canTip={canTip}
        />
      )}
    </div>
  );
}
