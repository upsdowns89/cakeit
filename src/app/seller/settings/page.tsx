'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeftIcon, UserCircleIcon, LockIcon, CurrencyIcon,
  ClipboardDocumentListIcon, DocumentTextIcon, ArrowRightOnRectangleIcon,
  TrashIcon, ChevronRightIcon, XMarkIcon, CogIcon,
} from '@/components/icons';

type SettingsSection = 'main' | 'profile' | 'password' | 'sales' | 'order-form' | 'terms';

export default function SellerSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [section, setSection] = useState<SettingsSection>('main');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Logout / Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePw, setDeletePw] = useState('');

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // Load profile
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('nickname, avatar_url').eq('id', user.id).single();
      if (data) {
        setNickname((data as any).nickname || '');
        setAvatarUrl((data as any).avatar_url || '');
      }
    }
    load();
  }, []);

  // Save profile
  const handleSaveProfile = async () => {
    setProfileSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ nickname }).eq('id', user.id);
    if (error) showMsg('error', '저장 실패');
    else showMsg('success', '프로필이 저장되었습니다.');
    setProfileSaving(false);
  };

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('shop-images').upload(path, file);
    if (upErr) { showMsg('error', '업로드 실패'); return; }
    const { data: { publicUrl } } = supabase.storage.from('shop-images').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setAvatarUrl(publicUrl);
    showMsg('success', '프로필 이미지가 변경되었습니다.');
  };

  // Change password
  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { showMsg('error', '새 비밀번호가 일치하지 않습니다.'); return; }
    if (newPw.length < 6) { showMsg('error', '비밀번호는 6자 이상이어야 합니다.'); return; }
    setPwSaving(true);

    // Verify current password by re-signing in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPwSaving(false); return; }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
    if (signInErr) { showMsg('error', '현재 비밀번호가 올바르지 않습니다.'); setPwSaving(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) showMsg('error', error.message);
    else { showMsg('success', '비밀번호가 변경되었습니다.'); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    setPwSaving(false);
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Delete account
  const handleDeleteAccount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: deletePw });
    if (signInErr) { showMsg('error', '비밀번호가 올바르지 않습니다.'); return; }
    // Soft delete: mark profile inactive
    await supabase.from('profiles').update({ role: 'deleted' }).eq('id', user.id);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const menuItems = [
    { key: 'profile' as const, icon: UserCircleIcon, label: '내 프로필 정보', desc: '닉네임, 프로필 이미지 관리' },
    { key: 'password' as const, icon: LockIcon, label: '비밀번호 관리', desc: '비밀번호 변경' },
    { key: 'sales' as const, icon: CurrencyIcon, label: '판매내역', desc: '월별 판매 요약' },
    { key: 'order-form' as const, icon: ClipboardDocumentListIcon, label: '주문서 관리', desc: '고객 주문서 설정' },
    { key: 'terms' as const, icon: DocumentTextIcon, label: '약관 및 정책', desc: '서비스 이용약관' },
  ];

  return (
    <div className="page-container">
      {/* GNB */}
      <div className="sticky top-0 z-50 flex items-center gap-3 bg-white/95 px-4 py-2.5 backdrop-blur-lg border-b border-surface-200/60">
        <button onClick={() => section === 'main' ? router.back() : setSection('main')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-100">
          <ArrowLeftIcon className="h-5 w-5 text-surface-700" />
        </button>
        <h1 className="text-lg font-bold text-surface-900">
          {section === 'main' ? '설정' : menuItems.find(m => m.key === section)?.label || '설정'}
        </h1>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-4 mt-2 rounded-lg px-3 py-2 text-xs font-medium animate-fade-in ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{message.text}</div>
      )}

      <div className="px-4 py-4">

        {/* ═══ MAIN MENU ═══ */}
        {section === 'main' && (
          <div className="space-y-2">
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
              {menuItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button key={item.key} onClick={() => setSection(item.key)}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-50 ${i > 0 ? 'border-t border-surface-100' : ''}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-100">
                      <Icon className="h-4.5 w-4.5 text-surface-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-900">{item.label}</p>
                      <p className="text-xs text-surface-400">{item.desc}</p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-surface-300" />
                  </button>
                );
              })}
            </div>

            {/* Danger Zone */}
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden mt-4">
              <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-100">
                  <ArrowRightOnRectangleIcon className="h-4.5 w-4.5 text-surface-600" />
                </div>
                <p className="text-sm font-medium text-surface-700">로그아웃</p>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center gap-3 border-t border-surface-100 px-4 py-3.5 text-left transition-colors hover:bg-red-50">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
                  <TrashIcon className="h-4.5 w-4.5 text-red-400" />
                </div>
                <p className="text-sm font-medium text-red-500">탈퇴하기</p>
              </button>
            </div>
          </div>
        )}

        {/* ═══ PROFILE ═══ */}
        {section === 'profile' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center">
              <button onClick={() => avatarInputRef.current?.click()} className="relative group">
                <div className="h-24 w-24 overflow-hidden rounded-full bg-surface-100">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center"><UserCircleIcon className="h-12 w-12 text-surface-300" /></div>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-semibold text-white">변경</span>
                </div>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              <p className="mt-2 text-xs text-surface-400">클릭하여 프로필 사진 변경</p>
            </div>

            <label className="block">
              <span className="form-label">닉네임</span>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="form-input" />
            </label>

            <button onClick={handleSaveProfile} disabled={profileSaving} className="btn-primary w-full disabled:opacity-50">
              {profileSaving ? '저장 중...' : '프로필 저장'}
            </button>
          </div>
        )}

        {/* ═══ PASSWORD ═══ */}
        {section === 'password' && (
          <div className="space-y-4">
            <label className="block">
              <span className="form-label">현재 비밀번호</span>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="form-input" />
            </label>
            <label className="block">
              <span className="form-label">새 비밀번호</span>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" className="form-input" />
            </label>
            <label className="block">
              <span className="form-label">새 비밀번호 확인</span>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="form-input" />
              {confirmPw && newPw !== confirmPw && <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다</p>}
            </label>
            <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw || newPw !== confirmPw}
              className="btn-primary w-full disabled:opacity-50">
              {pwSaving ? '변경 중...' : '비밀번호 변경'}
            </button>
          </div>
        )}

        {/* ═══ SALES ═══ */}
        {section === 'sales' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-white p-6 text-center">
              <CurrencyIcon className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-lg font-bold text-surface-900">판매내역</h3>
              <p className="mt-2 text-sm text-surface-500">주문 시스템이 연동되면 월별 판매 내역과 매출 합계를 확인할 수 있습니다.</p>
              <div className="mt-4 rounded-xl bg-surface-50 p-4">
                <p className="text-xs text-surface-400">준비 중인 기능입니다</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ORDER FORM ═══ */}
        {section === 'order-form' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-white p-6 text-center">
              <ClipboardDocumentListIcon className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-lg font-bold text-surface-900">주문서 관리</h3>
              <p className="mt-2 text-sm text-surface-500">고객이 작성할 주문서 양식을 세팅할 수 있습니다. 질문 항목, 옵션 등을 설정해보세요.</p>
              <div className="mt-4 rounded-xl bg-surface-50 p-4">
                <p className="text-xs text-surface-400">준비 중인 기능입니다</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ TERMS ═══ */}
        {section === 'terms' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-white p-6 text-center">
              <DocumentTextIcon className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-lg font-bold text-surface-900">약관 및 정책</h3>
              <p className="mt-2 text-sm text-surface-500">서비스 이용약관, 개인정보 처리방침 등이 이곳에 표시됩니다.</p>
              <div className="mt-4 rounded-xl bg-surface-50 p-4">
                <p className="text-xs text-surface-400">관리자가 등록하면 표시됩니다</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-surface-900">정말 탈퇴하시겠어요?</h3>
              <button onClick={() => setShowDeleteConfirm(false)}><XMarkIcon className="h-5 w-5 text-surface-400" /></button>
            </div>
            <p className="text-sm text-surface-500 mb-4">탈퇴하면 가게 정보와 데이터가 비활성화됩니다. 이 작업은 되돌릴 수 없습니다.</p>
            <label className="block mb-4">
              <span className="text-xs font-medium text-surface-600">비밀번호 확인</span>
              <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)} className="form-input mt-1" placeholder="현재 비밀번호를 입력하세요" />
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-xl border border-surface-200 py-3 text-sm font-medium text-surface-600">취소</button>
              <button onClick={handleDeleteAccount} disabled={!deletePw}
                className="flex-1 rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-50">탈퇴하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
