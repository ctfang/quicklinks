import { Input, Button, Modal, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { NavGroup } from '../services/api';

interface GroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, order: number) => Promise<void>;
  initialData?: NavGroup | null;
}

export const GroupModal: React.FC<GroupModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [name, setName] = useState('');
  const [order, setOrder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setOrder(initialData?.order ?? 0);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(name.trim(), order);
      onClose();
    } catch (error) {
      console.error('Failed to save group:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal destroyOnHidden open={isOpen} title={initialData ? '编辑分组' : '新建分组'} centered width={480} footer={null} zIndex={1000}
      onCancel={() => { if (!isSubmitting) onClose(); }} mask={{ closable: !isSubmitting }} keyboard={!isSubmitting} closable={!isSubmitting}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
      <Typography.Paragraph type="secondary">{'按分组整理您的导航链接。'}</Typography.Paragraph>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1">分组名称</label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
              placeholder="例如：常用工具"
              autoFocus
            aria-label="例如：常用工具" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1">显示顺序</label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              className="w-full"
              placeholder="数字越小越靠前"
            aria-label="数字越小越靠前" />
            <p className="text-xs text-[var(--ui-text-secondary)] mt-1">数字越小排序越靠前</p>
          </div>

          <div className="pt-4 flex gap-3">
            <Button type="default"
              htmlType="button"
              onClick={onClose} disabled={isSubmitting}
              className="flex-1"
            >
              取消
            </Button>
            <Button type="primary"
              htmlType="submit"
              loading={isSubmitting} disabled={isSubmitting || !name.trim()}
              className="flex-1"
            >
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>

    </Modal>
  );
};
