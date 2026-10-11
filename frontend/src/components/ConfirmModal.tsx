import { useState } from 'react';
import { Alert, Modal } from 'antd';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message,
  confirmText = '确认', cancelText = '取消', isDestructive = true }: ConfirmModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };
  return <Modal open={isOpen} title={title} centered width={440} zIndex={1100}
    onCancel={() => { if (!loading) { setError(''); onClose(); } }} onOk={confirm}
    confirmLoading={loading} okText={confirmText} cancelText={cancelText}
    mask={{ closable: !loading }} keyboard={!loading} closable={!loading}
    okButtonProps={{ danger: isDestructive }} cancelButtonProps={{ disabled: loading }}>
    <p className="py-3 leading-relaxed">{message}</p>
    {error && <Alert type="error" title={error} showIcon />}
  </Modal>;
};
