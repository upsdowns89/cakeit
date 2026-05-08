'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BookmarkSolidIcon, XMarkIcon, PlusIcon } from '@/components/icons';

/* ─── localStorage 기반 그룹/저장 관리 ─── */

export interface SaveGroup {
  id: string;
  name: string;
  createdAt: string;
}

export interface SavedItem {
  imageId: string;
  imageUrl: string;
  shopName: string;
  shopId: string;
  district?: string;
  menuName?: string;
  savedAt: string;
  groupId: string;
}

const GROUPS_KEY = 'everycake_save_groups';
const ITEMS_KEY = 'everycake_saved_items';

/* ─── Helper functions ─── */

export function getSaveGroups(): SaveGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) {
      // Default group
      const defaultGroup: SaveGroup = {
        id: 'default',
        name: '모든 저장',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(GROUPS_KEY, JSON.stringify([defaultGroup]));
      return [defaultGroup];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSaveGroups(groups: SaveGroup[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

export function getSavedItems(): SavedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSavedItems(items: SavedItem[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function isItemSaved(imageId: string): boolean {
  return getSavedItems().some(item => item.imageId === imageId);
}

export function getItemsByGroup(groupId: string): SavedItem[] {
  const items = getSavedItems();
  if (groupId === 'all') return items;
  return items.filter(i => i.groupId === groupId);
}

export function addItemToGroup(item: Omit<SavedItem, 'savedAt' | 'groupId'>, groupId: string): void {
  const items = getSavedItems();
  // Remove if already in this group
  const filtered = items.filter(i => !(i.imageId === item.imageId && i.groupId === groupId));
  filtered.push({ ...item, groupId, savedAt: new Date().toISOString() });
  saveSavedItems(filtered);
}

export function removeItemFromGroup(imageId: string, groupId: string): void {
  const items = getSavedItems();
  saveSavedItems(items.filter(i => !(i.imageId === imageId && i.groupId === groupId)));
}

export function removeItemFromAll(imageId: string): void {
  const items = getSavedItems();
  saveSavedItems(items.filter(i => i.imageId !== imageId));
}

export function getGroupCoverImage(groupId: string): string | null {
  const items = getItemsByGroup(groupId);
  return items.length > 0 ? items[items.length - 1].imageUrl : null;
}

/* ─── Bottom Sheet Component ─── */

interface SaveBookmarkSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (groupName: string) => void;
  onRemoved?: (groupName: string) => void;
  imageId: string;
  imageUrl: string;
  shopName: string;
  shopId: string;
  district?: string;
  menuName?: string;
}

export default function SaveBookmarkSheet({
  isOpen,
  onClose,
  onSaved,
  onRemoved,
  imageId,
  imageUrl,
  shopName,
  shopId,
  district,
  menuName,
}: SaveBookmarkSheetProps) {
  const [groups, setGroups] = useState<SaveGroup[]>([]);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    if (isOpen) {
      setGroups(getSaveGroups());
      setSavedItems(getSavedItems());
      setShowNewGroupInput(false);
      setNewGroupName('');
    }
  }, [isOpen]);

  // Focus input when shown
  useEffect(() => {
    if (showNewGroupInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewGroupInput]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 280);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isInGroup = (groupId: string) => {
    return savedItems.some(i => i.imageId === imageId && i.groupId === groupId);
  };

  /** Tap a group → toggle: add if not saved, remove if already saved */
  const handleGroupTap = (group: SaveGroup) => {
    if (isInGroup(group.id)) {
      // Remove from this group
      removeItemFromGroup(imageId, group.id);
      onRemoved?.(group.name);
    } else {
      // Add to this group
      addItemToGroup({ imageId, imageUrl, shopName, shopId, district, menuName }, group.id);
      onSaved?.(group.name);
    }
    handleClose();
  };

  const handleCreateGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;

    const newGroup: SaveGroup = {
      id: `group_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
    };

    const updated = [...groups, newGroup];
    saveSaveGroups(updated);

    // Auto-save to this new group
    addItemToGroup({ imageId, imageUrl, shopName, shopId, district, menuName }, newGroup.id);

    // Close and toast
    onSaved?.(newGroup.name);
    handleClose();
  };

  return (
    <div
      className={`save-sheet-overlay ${isClosing ? 'save-sheet-closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`save-sheet-container ${isClosing ? 'save-sheet-slide-down' : ''}`}>
        {/* Header */}
        <div className="save-sheet-header">
          <h3 className="text-base font-bold text-surface-900">그룹에 저장</h3>
          <button onClick={handleClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-100">
            <XMarkIcon className="h-5 w-5 text-surface-500" />
          </button>
        </div>

        {/* Group List */}
        <div className="save-sheet-body">
          {groups.map((group) => {
            const cover = getGroupCoverImage(group.id);
            const count = getItemsByGroup(group.id).length;
            const checked = isInGroup(group.id);

            return (
              <button
                key={group.id}
                onClick={() => handleGroupTap(group)}
                className={`save-sheet-group-item ${checked ? 'save-sheet-group-active' : ''}`}
              >
                <div className="save-sheet-group-cover">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <BookmarkSolidIcon className="h-5 w-5 text-surface-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-surface-900 truncate">{group.name}</p>
                  <p className="text-xs text-surface-400">{count}개 저장됨</p>
                </div>
                {checked && (
                  <div className="save-sheet-saved-badge">
                    저장됨
                  </div>
                )}
              </button>
            );
          })}

          {/* New Group Input */}
          {showNewGroupInput ? (
            <div className="save-sheet-new-group">
              <input
                ref={inputRef}
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateGroup(); }}
                placeholder="그룹 이름 입력"
                className="save-sheet-input"
                maxLength={20}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowNewGroupInput(false)}
                  className="flex-1 rounded-full border border-surface-200 py-2 text-sm text-surface-500"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                  className="flex-1 rounded-full bg-surface-900 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  생성
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewGroupInput(true)}
              className="save-sheet-add-btn"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-surface-200">
                <PlusIcon className="h-5 w-5 text-surface-400" />
              </div>
              <span className="text-sm font-medium text-surface-600">새 그룹 추가</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
