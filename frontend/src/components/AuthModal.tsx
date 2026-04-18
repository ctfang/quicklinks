import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Mail, Lock, User as UserIcon } from 'lucide-react';
import { login, register, requestPasswordReset } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { sha256Hex } from '../lib/passwordHash';

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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const pwdHash = await sha256Hex(password);
        const u = await login(email, pwdHash);
        await loginUser(u);
        onClose();
      } else if (mode === 'register') {
        const pwdHash = await sha256Hex(password);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账号' : '忘记密码'}
          </h2>
          <p className="text-white/60 text-sm mb-8">
            {mode === 'login'
              ? '登录您的 NaviHub 账号'
              : mode === 'register'
                ? '加入 NaviHub，管理您的导航'
                : '输入邮箱后我们将发送 6 位验证码'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input 
                  type="text" 
                  placeholder="您的姓名" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input 
                type="email" 
                placeholder="邮箱地址" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {mode !== 'forgot_password' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
                <input 
                  type="password" 
                  placeholder="密码" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {successMsg && <p className="text-green-400 text-sm">{successMsg}</p>}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {isLoading ? '请稍候...' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送验证码'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/60">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button onClick={() => setMode('register')} className="text-blue-400 hover:text-blue-300">立即注册</button>
                <span className="mx-2">|</span>
                <button onClick={() => setMode('forgot_password')} className="text-blue-400 hover:text-blue-300">忘记密码</button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button onClick={() => setMode('login')} className="text-blue-400 hover:text-blue-300">返回登录</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
