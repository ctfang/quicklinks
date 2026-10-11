import { Input, Button, Modal, Typography } from 'antd';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon } from 'lucide-react';
import { login, register, requestPasswordReset } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { md5Hex } from '../lib/passwordHash';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const navigate = useNavigate();
  const { loginUser } = useAppContext();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const pwdHash = md5Hex(password);
        const u = await login(email, pwdHash);
        await loginUser(u);
        onClose();
      } else if (mode === 'register') {
        const pwdHash = md5Hex(password);
        const u = await register(name, email, pwdHash);
        await loginUser(u);
        onClose();
      } else if (mode === 'forgot_password') {
        await requestPasswordReset(email);
        onClose();
        const em = encodeURIComponent(email.trim());
        navigate(`/reset-password?email=${em}&sent=1`);
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal destroyOnHidden open={isOpen} title={mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : '忘记密码'} centered width={480} footer={null} zIndex={1000}
      onCancel={() => { if (!isLoading) onClose(); }} mask={{ closable: !isLoading }} keyboard={!isLoading} closable={!isLoading}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
      <Typography.Paragraph type="secondary">{mode === 'login' ? '登录您的 NaviHub 账号' : mode === 'register' ? '加入 NaviHub，管理您的导航' : '输入邮箱后我们将发送 6 位验证码'}</Typography.Paragraph>
      <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <Input prefix={<UserIcon size={18} />}
                  type="text"
                  placeholder="您的姓名"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full"
                aria-label="您的姓名" />
              </div>
            )}

            <div className="relative">
              <Input prefix={<Mail size={18} />}
                type="email"
                placeholder="邮箱地址"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              aria-label="邮箱地址" />
            </div>

            {mode !== 'forgot_password' && (
              <div className="relative">
                <Input prefix={<Lock size={18} />}
                  type="password"
                  placeholder="密码"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                aria-label="密码" />
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {successMsg && <p className="text-green-400 text-sm">{successMsg}</p>}

            <Button type="primary"
              htmlType="submit"
              loading={isLoading} disabled={isLoading}
              className="w-full mt-2"
            >
              {isLoading ? '请稍候...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送验证码'}
            </Button>
          </form>
      <div className="mt-6 text-center text-sm text-[var(--ui-text-secondary)]">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <Button type="link" onClick={() => setMode('register')} >立即注册</Button>
                <span className="mx-2">|</span>
                <Button type="link" onClick={() => setMode('forgot_password')} >忘记密码</Button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <Button type="link" onClick={() => setMode('login')} >返回登录</Button>
              </>
            )}
          </div>
    </Modal>
  );
};
