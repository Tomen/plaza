import { useState, useRef, useCallback } from 'react';
import { truncateAddress } from '../../utils/formatters';
import { ProfileTooltip } from './ProfileTooltip';
import type { UserLinkProps } from './types';

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
};

const HOVER_DELAY = 300;
const HIDE_DELAY = 150; // Delay before hiding to allow moving to tooltip

export function UserLink({
  address,
  displayName,
  onSelectUser,
  isCurrentUser = false,
  isDelegate = false,
  size = 'sm',
  className = '',
  // Tooltip props
  getProfile,
  provider,
  onStartDM,
  canSendDM = false,
  onFollow,
  onUnfollow,
  isFollowing = false,
  onTip,
  canTip = false,
}: UserLinkProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isOverTooltipRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayText = displayName || truncateAddress(address);
  const hasTooltip = !!getProfile;

  const cancelTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!hasTooltip) return;

    // Cancel any pending hide
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    // Start show timer
    showTimerRef.current = window.setTimeout(() => {
      if (buttonRef.current) {
        setTriggerRect(buttonRef.current.getBoundingClientRect());
        setShowTooltip(true);
      }
    }, HOVER_DELAY);
  }, [hasTooltip]);

  const handleMouseLeave = useCallback(() => {
    // Cancel show timer
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    // Delay hide to allow moving to tooltip
    hideTimerRef.current = window.setTimeout(() => {
      // Only hide if not over tooltip
      if (!isOverTooltipRef.current) {
        setShowTooltip(false);
      }
    }, HIDE_DELAY);
  }, []);

  const handleTooltipMouseEnter = useCallback(() => {
    isOverTooltipRef.current = true;
    // Cancel any pending hide
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleTooltipMouseLeave = useCallback(() => {
    isOverTooltipRef.current = false;
    setShowTooltip(false);
    cancelTimers();
  }, [cancelTimers]);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => onSelectUser(address)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`
          font-mono
          ${sizeClasses[size]}
          ${isCurrentUser ? 'text-accent-400 font-semibold' : 'text-primary-500'}
          hover:text-primary-400
          hover:underline
          cursor-pointer
          transition-colors
        `}
        title={hasTooltip ? undefined : address}
      >
        {displayText}
      </button>
      {isDelegate && (
        <span className="text-primary-700 text-xs">
          (via delegate)
        </span>
      )}

      {/* Tooltip */}
      {showTooltip && triggerRect && getProfile && (
        <ProfileTooltip
          address={address}
          triggerRect={triggerRect}
          getProfile={getProfile}
          provider={provider}
          onStartDM={onStartDM}
          canSendDM={canSendDM}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          isFollowing={isFollowing}
          onTip={onTip}
          canTip={canTip}
          isOwnProfile={isCurrentUser}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </span>
  );
}
