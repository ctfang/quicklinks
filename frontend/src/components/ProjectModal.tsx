import { Input, Button, Modal, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { Project } from '../services/api';
import { X } from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  initialData?: Project;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave(name, description);
      onClose();
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal destroyOnHidden open={isOpen} title={initialData ? '编辑项目' : '新建项目'} centered width={480} footer={null} zIndex={1000}
      onCancel={() => { if (!isSubmitting) onClose(); }} mask={{ closable: !isSubmitting }} keyboard={!isSubmitting} closable={!isSubmitting}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
      <Typography.Paragraph type="secondary">{'维护项目名称与说明。'}</Typography.Paragraph>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1.5">
              项目名称 <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
              placeholder="例如：NaviHub 重构"
              required
            aria-label="例如：NaviHub 重构" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--ui-text-secondary)] mb-1.5">
              项目描述
            </label>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full"
              placeholder="简要描述该项目..."
            aria-label="简要描述该项目..." />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="default"
              htmlType="button"
              onClick={onClose} disabled={isSubmitting}

            >
              取消
            </Button>
            <Button type="primary"
              htmlType="submit"
              loading={isSubmitting} disabled={isSubmitting || !name.trim()}

            >
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>

    </Modal>
  );
};
