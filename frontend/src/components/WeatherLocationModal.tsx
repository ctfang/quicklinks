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
  const [adcode, setAdcode] = useState(weatherLocation.adcode);

  useEffect(() => {
    if (open) {
      setProvince(weatherLocation.province);
      setCity(weatherLocation.city);
      setAdcode(weatherLocation.adcode);
    }
  }, [open, weatherLocation.province, weatherLocation.city, weatherLocation.adcode]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setWeatherLocation({ province, city, adcode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="weather-location-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="weather-location-title" className="text-lg font-semibold text-white">
            天气城市
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-white/60 mb-4">
          将保存到本浏览器，用于顶部天气与背景效果；需与第三方接口支持的省、市名称一致。
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wl-province" className="block text-sm text-white/80 mb-1">
              省份
            </label>
            <input
              id="wl-province"
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="例如：广东"
              autoComplete="address-level1"
            />
          </div>
          <div>
            <label htmlFor="wl-city" className="block text-sm text-white/80 mb-1">
              城市
            </label>
            <input
              id="wl-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="例如：深圳"
              autoComplete="address-level2"
            />
          </div>
          <div>
            <label htmlFor="wl-adcode" className="block text-sm text-white/80 mb-1">
              城市编码（adcode）
            </label>
            <input
              id="wl-adcode"
              type="text"
              value={adcode}
              onChange={(e) => setAdcode(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              placeholder="例如：440300（留空则使用省/市查询）"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
