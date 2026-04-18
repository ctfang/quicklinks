import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const ClockWidget = () => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center text-white drop-shadow-2xl mb-12 select-none">
      <h1 className="text-8xl md:text-[8rem] font-medium tracking-tight leading-none drop-shadow-lg">
        {format(time, 'HH:mm')}
      </h1>
      <p className="text-xl md:text-2xl font-medium mt-4 opacity-90 tracking-wide drop-shadow-md">
        {format(time, 'MMMMdo EEEE', { locale: zhCN })}
      </p>
    </div>
  );
};
