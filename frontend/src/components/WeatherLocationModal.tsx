import { Input, Button, Modal, Typography } from 'antd';
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const WeatherLocationModal = ({ open, onClose }: Props) => {
  const { weatherLocation, setWeatherLocation } = useAppContext();
  const [province, setProvince] = useState(weatherLocation.province);
  const [city, setCity] = useState(weatherLocation.city);

  useEffect(() => {
    if (open) {
      setProvince(weatherLocation.province);
      setCity(weatherLocation.city);
    }
  }, [open, weatherLocation.province, weatherLocation.city]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWeatherLocation({ province, city });
    onClose();
  };

  return (
    <Modal destroyOnHidden open={open} title={'天气城市'} centered width={480} footer={null} zIndex={1000}
      onCancel={onClose}
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}>
      <Typography.Paragraph type="secondary">{'将保存到本浏览器，用于顶部天气与背景效果；需与第三方接口支持的省、市名称一致。'}</Typography.Paragraph>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wl-province" className="block text-sm text-[var(--ui-text-secondary)] mb-1">
              省份
            </label>
            <Input
              id="wl-province"
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full"
              placeholder="例如：广东"
              autoComplete="address-level1"
            aria-label="例如：广东" />
          </div>
          <div>
            <label htmlFor="wl-city" className="block text-sm text-[var(--ui-text-secondary)] mb-1">
              城市
            </label>
            <Input
              id="wl-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full"
              placeholder="例如：深圳"
              autoComplete="address-level2"
            aria-label="例如：深圳" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="default"
              htmlType="button"
              onClick={onClose}

            >
              取消
            </Button>
            <Button type="primary"
              htmlType="submit"

            >
              保存
            </Button>
          </div>
        </form>

    </Modal>
  );
};
