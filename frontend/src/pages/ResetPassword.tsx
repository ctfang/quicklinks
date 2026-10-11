import { Input, Button } from 'antd';
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { confirmPasswordReset, requestPasswordReset } from '../services/api';
import { md5Hex } from '../lib/passwordHash';
import { Lock, ArrowLeft, Mail, KeyRound } from 'lucide-react';

export const ResetPassword = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setEmail(decodeURIComponent(q));
    // 登录弹窗里已发过验证码，避免本页再点一次导致发两封邮件
    if (searchParams.get('sent') === '1') {
      setCodeSent(true);
    }
  }, [searchParams]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const em = email.trim();
    if (!em) {
      setError('请填写邮箱');
      return;
    }
    setSending(true);
    try {
      await requestPasswordReset(em);
      setCodeSent(true);
      setSearchParams({ email: em });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const em = email.trim();
    if (!codeSent) {
      setError('请先发送并查收邮箱验证码');
      return;
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError('请输入 6 位数字验证码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== password2) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const pwdHash = md5Hex(password);
      await confirmPasswordReset(em, code.trim(), pwdHash);
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6"
        >
          <ArrowLeft size={16} />
          返回首页
        </Link>
        <h1 className="text-2xl font-bold text-white mb-2">重置密码</h1>
        <p className="text-white/50 text-sm mb-8">
          先向邮箱发送验证码，填写验证码后再设置新密码
        </p>

        {done ? (
          <p className="text-emerald-400 text-center py-4">
            密码已更新，请返回首页登录。
          </p>
        ) : (
          <form onSubmit={codeSent ? handleSubmit : handleSendCode} className="space-y-4">
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                {error}
              </div>
            )}
            <div className="relative">
              <Input prefix={<Mail size={18} />}
                type="email"
                autoComplete="email"
                placeholder="注册邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending || loading}
                className="w-full"
              />
            </div>

            {!codeSent ? (
              <Button type="primary"
                htmlType="submit"
                disabled={sending}
                className="w-full"
              >
                {sending ? '发送中...' : '发送验证码'}
              </Button>
            ) : (
              <>
                <p className="text-white/40 text-xs">
                  验证码已发送，请查收邮件（约 15 分钟内有效）。如需重发请修改邮箱后再次点击发送。
                </p>
                <div className="relative">
                  <Input prefix={<KeyRound size={18} />}
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    className="w-full"
                  />
                </div>
                <div className="relative">
                  <Input prefix={<Lock size={18} />}
                    type="password"
                    autoComplete="new-password"
                    placeholder="新密码（至少 6 位）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || code.trim().length !== 6}
                    className="w-full"
                  />
                </div>
                <div className="relative">
                  <Input prefix={<Lock size={18} />}
                    type="password"
                    autoComplete="new-password"
                    placeholder="确认新密码"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    disabled={loading || code.trim().length !== 6}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="default"
                    htmlType="button"
                    onClick={() => {
                      setCodeSent(false);
                      setCode('');
                      setPassword('');
                      setPassword2('');
                      setError('');
                      const em = email.trim();
                      setSearchParams(em ? { email: em } : {});
                    }}
                    disabled={loading}
                    className="flex-1"
                  >
                    重发验证码
                  </Button>
                  <Button type="primary"
                    htmlType="submit"
                    disabled={loading || code.trim().length !== 6}
                    className="flex-1"
                  >
                    {loading ? '提交中...' : '确认修改密码'}
                  </Button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
