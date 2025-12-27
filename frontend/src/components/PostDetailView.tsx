import { useState, useEffect, useCallback } from 'react';
import type { UserPost, VoteType, VoteTally, Profile } from '../types/contracts';
import { VotingWidget } from './VotingWidget';
import { ReplyThread } from './ReplyThread';
import { UserLink } from './UserAddress';
import { formatTimestamp } from '../utils/formatters';
import type { Provider, Signer } from '../utils/contracts';
import { EntityType } from '../hooks/useVoting';
import toast from 'react-hot-toast';

interface PostDetailViewProps {
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
  onBack: () => void;
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

export function PostDetailView({
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
  onBack,
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
}: PostDetailViewProps) {
  const [entityId, setEntityId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
      onBack();
    } catch (error) {
      console.error('Failed to delete post:', error);
      toast.error('Failed to delete post');
      setIsDeleting(false);
    }
  };

  if (post.isDeleted) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-primary-700">
          <button
            onClick={onBack}
            className="text-sm font-mono text-primary-500 hover:text-primary-400"
          >
            &larr; BACK TO POSTS
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-primary-700 font-mono italic">[POST DELETED]</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="px-4 py-3 border-b border-primary-700 flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm font-mono text-primary-500 hover:text-primary-400"
        >
          &larr; BACK TO POSTS
        </button>
        <span className="text-primary-700 font-mono text-xs">#{post.index}</span>
      </div>

      {/* Post content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Meta info */}
          <div className="flex items-center gap-3 font-mono text-sm mb-6 pb-4 border-b border-primary-800">
            {onSelectUser && (
              <UserLink
                address={post.profileOwner}
                displayName={post.displayName}
                onSelectUser={onSelectUser}
                isDelegate={isDelegate}
                size="sm"
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
          </div>

          {/* Content or Edit Form */}
          {isEditing ? (
            <div className="mb-6">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[200px] px-3 py-2 bg-black border border-primary-600 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 resize-y"
                maxLength={40000}
                disabled={isSaving}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs font-mono text-primary-600">
                  {editContent.length.toLocaleString()} / 40,000
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editContent.trim()}
                    className="px-4 py-2 text-sm font-mono text-primary-400 border border-primary-500 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'SAVING...' : 'SAVE'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(post.content);
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-mono text-primary-600 border border-primary-700 hover:border-primary-500"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-primary-300 font-mono whitespace-pre-wrap mb-6 leading-relaxed">
              {post.content}
            </div>
          )}

          {/* Actions Row */}
          {!isEditing && (
            <div className="flex items-center gap-4 py-4 border-t border-primary-800 border-b border-primary-800 mb-6">
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
                />
              )}

              {/* Edit/Delete for owner */}
              {isOwner && !disabled && (
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm font-mono text-primary-600 hover:text-primary-400"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-sm font-mono text-red-600 hover:text-red-400 disabled:opacity-50"
                  >
                    {isDeleting ? 'DELETING...' : 'DELETE'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Replies Section */}
          {userPostsAddress && (
            <div>
              <h2 className="text-sm font-mono text-primary-500 mb-4">REPLIES</h2>
              <ReplyThread
                repliesAddress={repliesAddress}
                votingAddress={votingAddress}
                userPostsAddress={userPostsAddress}
                postIndex={post.index}
                entityType={EntityType.UserPost}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
