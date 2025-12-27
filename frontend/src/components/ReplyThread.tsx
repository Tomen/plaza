import { useState, useEffect, useCallback } from 'react';
import type { Reply, VoteType, VoteTally } from '../types/contracts';
import { useReplies, EntityType } from '../hooks/useReplies';
import { useVoting, EntityType as VotingEntityType } from '../hooks/useVoting';
import { ReplyItem } from './ReplyItem';
import type { Provider, Signer } from '../utils/contracts';
import toast from 'react-hot-toast';

interface ReplyThreadProps {
  repliesAddress: string | null;
  votingAddress: string | null;
  userPostsAddress: string | null;
  postIndex: number;
  provider: Provider | null;
  signer?: Signer | null;
  currentAddress: string | null;
  getDisplayName?: (address: string) => Promise<string>;
  onSelectUser?: (address: string) => void;
  disabled?: boolean;
}

export function ReplyThread({
  repliesAddress,
  votingAddress,
  userPostsAddress,
  postIndex,
  provider,
  signer,
  currentAddress,
  getDisplayName,
  onSelectUser,
  disabled = false,
}: ReplyThreadProps) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null); // null = new reply form hidden, 0 = top-level, 1+ = nested
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childRepliesMap, setChildRepliesMap] = useState<Record<number, Reply[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<Set<number>>(new Set());

  const {
    replies,
    replyCount,
    isLoading,
    addReply,
    editReply,
    deleteReply,
    refresh,
    getChildReplies,
  } = useReplies({
    repliesAddress,
    parentContract: userPostsAddress,
    entityType: EntityType.UserPost,
    entityIndex: postIndex,
    provider,
    signer,
    getDisplayName,
    enabled: !disabled,
  });

  const {
    vote,
    removeVote,
    getVoteTally,
    getUserVote,
    computeEntityId,
    isVoting,
  } = useVoting({
    votingAddress,
    provider,
    signer,
    userAddress: currentAddress,
    enabled: !disabled,
  });

  // Compute entity ID for a reply
  const getReplyEntityId = useCallback(
    async (replyIndex: number): Promise<string> => {
      if (!repliesAddress) return '';
      return computeEntityId(repliesAddress, VotingEntityType.Reply, replyIndex);
    },
    [repliesAddress, computeEntityId]
  );

  // Load child replies for a parent reply
  const loadChildReplies = useCallback(
    async (parentReplyIndex: number) => {
      if (loadingChildren.has(parentReplyIndex)) return;

      setLoadingChildren(prev => new Set(prev).add(parentReplyIndex));
      try {
        const children = await getChildReplies(parentReplyIndex);
        setChildRepliesMap(prev => ({
          ...prev,
          [parentReplyIndex]: children,
        }));
      } catch (err) {
        console.error('Failed to load child replies:', err);
      } finally {
        setLoadingChildren(prev => {
          const next = new Set(prev);
          next.delete(parentReplyIndex);
          return next;
        });
      }
    },
    [getChildReplies, loadingChildren]
  );

  // Load children for all top-level replies
  useEffect(() => {
    replies.forEach((reply) => {
      loadChildReplies(reply.index);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replies]);

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || isSubmitting || replyingTo === null) return;

    setIsSubmitting(true);
    try {
      await addReply(replyContent, replyingTo);
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply added');
    } catch (error) {
      console.error('Failed to add reply:', error);
      toast.error('Failed to add reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyClick = (parentReplyIndex: number) => {
    setReplyingTo(parentReplyIndex);
    setReplyContent('');
  };

  const renderReply = (reply: Reply): React.ReactNode => {
    const children = childRepliesMap[reply.index] || [];

    return (
      <ReplyItemWithVoting
        key={reply.index}
        reply={reply}
        repliesAddress={repliesAddress}
        currentAddress={currentAddress}
        getReplyEntityId={getReplyEntityId}
        getVoteTally={getVoteTally}
        getUserVote={getUserVote}
        vote={vote}
        removeVote={removeVote}
        isVoting={isVoting}
        onReply={handleReplyClick}
        onEdit={editReply}
        onDelete={deleteReply}
        onSelectUser={onSelectUser}
        children={children}
        renderChild={renderReply}
        disabled={disabled}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="py-4 font-mono text-xs text-primary-600">
        Loading replies...
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Reply Form */}
      {!disabled && (
        <div className="mb-4">
          {replyingTo === null ? (
            <button
              onClick={() => setReplyingTo(0)}
              className="text-xs font-mono text-primary-500 hover:text-primary-400"
            >
              + ADD REPLY ({replyCount})
            </button>
          ) : (
            <div className="border border-primary-700 p-3">
              <div className="text-xs font-mono text-primary-600 mb-2">
                {replyingTo === 0 ? 'REPLYING TO POST' : `REPLYING TO COMMENT #${replyingTo}`}
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write your reply..."
                className="w-full min-h-[60px] px-3 py-2 bg-black border border-primary-600 text-primary-400 font-mono text-sm focus:outline-none focus:border-primary-400 resize-y"
                maxLength={2000}
                disabled={isSubmitting}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleSubmitReply}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-4 py-1.5 text-xs font-mono text-primary-400 border border-primary-500 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'POSTING...' : 'POST REPLY'}
                </button>
                <button
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-mono text-primary-600 border border-primary-700 hover:border-primary-500"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Replies List */}
      {replies.length > 0 ? (
        <div className="space-y-2">
          {replies.map(renderReply)}
        </div>
      ) : (
        replyCount === 0 && (
          <div className="text-xs font-mono text-primary-700 py-2">
            No replies yet
          </div>
        )
      )}

      {/* Refresh button */}
      {replies.length > 0 && (
        <button
          onClick={refresh}
          className="text-xs font-mono text-primary-700 hover:text-primary-500 mt-2"
        >
          [REFRESH]
        </button>
      )}
    </div>
  );
}

// Helper component to handle entity ID fetching for each reply
interface ReplyItemWithVotingProps {
  reply: Reply;
  repliesAddress: string | null;
  currentAddress: string | null;
  getReplyEntityId: (replyIndex: number) => Promise<string>;
  getVoteTally: (entityId: string) => Promise<VoteTally>;
  getUserVote: (entityId: string) => Promise<VoteType>;
  vote: (entityId: string, voteType: VoteType) => Promise<void>;
  removeVote: (entityId: string) => Promise<void>;
  isVoting: boolean;
  onReply: (parentReplyIndex: number) => void;
  onEdit: (replyIndex: number, newContent: string) => Promise<void>;
  onDelete: (replyIndex: number) => Promise<void>;
  onSelectUser?: (address: string) => void;
  children: Reply[];
  renderChild: (child: Reply) => React.ReactNode;
  disabled: boolean;
}

function ReplyItemWithVoting({
  reply,
  getReplyEntityId,
  ...props
}: ReplyItemWithVotingProps) {
  const [entityId, setEntityId] = useState<string>('');

  useEffect(() => {
    getReplyEntityId(reply.index).then(setEntityId);
  }, [reply.index, getReplyEntityId]);

  if (!entityId) {
    return null;
  }

  return (
    <ReplyItem
      reply={reply}
      entityId={entityId}
      currentAddress={props.currentAddress}
      getVoteTally={props.getVoteTally}
      getUserVote={props.getUserVote}
      vote={props.vote}
      removeVote={props.removeVote}
      isVoting={props.isVoting}
      onReply={props.onReply}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
      onSelectUser={props.onSelectUser}
      children={props.children}
      renderChild={props.renderChild}
      disabled={props.disabled}
    />
  );
}
