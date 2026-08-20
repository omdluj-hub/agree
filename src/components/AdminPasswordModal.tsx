import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { verifyAdminPassword } from '../lib/security';

interface AdminPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = '관리자 비밀번호 확인',
  description = '관리자 전용 기능에 접근하려면 비밀번호를 입력해 주세요.'
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('비밀번호를 입력해 주세요.');
      return;
    }

    if (verifyAdminPassword(password)) {
      setErrorMsg(null);
      setPassword('');
      onSuccess();
    } else {
      setErrorMsg('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      setPassword('');
    }
  };

  const handleClose = () => {
    setPassword('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="modal-backdrop animate-fade-in">
      <div className="modal-card password-modal animate-scale-up" style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Lock className="text-primary" size={20} />
            <h3 className="modal-title">{title}</h3>
          </div>
          <button type="button" onClick={handleClose} className="btn-close-modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.5rem' }}>
            <p className="modal-desc" style={{ marginBottom: '1rem', fontSize: '0.88rem', color: '#475569' }}>
              {description}
            </p>

            <div className="form-group">
              <label className="form-label">
                <KeyRound size={15} />
                <span>관리자 비밀번호</span>
              </label>
              <input
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                className="form-input"
                autoFocus
                required
              />
            </div>

            {errorMsg && (
              <div className="alert-box error animate-shake" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: '0.82rem' }}>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={handleClose} className="btn-cancel">
              취소
            </button>
            <button type="submit" className="btn-primary-solid">
              <ShieldCheck size={16} />
              <span>확인</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
