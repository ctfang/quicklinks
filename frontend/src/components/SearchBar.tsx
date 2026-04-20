import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Globe } from 'lucide-react';
import { searchLinks, NavLink } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { buildSearchUrl } from '../lib/searchEngine';

export const SearchBar = () => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<NavLink[]>([]);
  const { user, currentTeam, guestNavUserId, searchEngine } = useAppContext();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length > 0) {
        const res = await searchLinks(query, {
          userId: user?.id ?? guestNavUserId ?? undefined,
          teamId: currentTeam?.id,
        });
        setResults(res);
      } else {
        setResults([]);
      }
    };
    
    const debounce = setTimeout(fetchResults, 200);
    return () => clearTimeout(debounce);
  }, [query, user, currentTeam, guestNavUserId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={wrapperRef}
      className={cn(
        "relative w-full max-w-3xl mx-auto transition-all duration-500 ease-out z-50",
        isFocused ? "scale-[1.02] -translate-y-1" : "scale-100"
      )}
    >
      {/* Decorative GIF (Animal playing above the search bar) */}
      <div 
        className={cn(
          "absolute -top-12 right-12 transition-all duration-500 ease-out pointer-events-none z-10",
          isFocused ? "-translate-y-6 rotate-[15deg] scale-[1.15]" : "translate-y-2 -rotate-[10deg] scale-90 opacity-80"
        )}
      >
        <img 
          src="/images/dog-face.png"
          alt="Playful dog mascot" 
          className="h-16 w-16 object-contain drop-shadow-xl relative z-10 origin-bottom"
          onError={(e) => {
             // Fallback to text emoji if image fails to load
             e.currentTarget.style.display = 'none';
             if (e.currentTarget.nextElementSibling) {
               (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
             }
          }}
        />
        <div className="text-5xl drop-shadow-xl hidden relative z-10">
          🐶
        </div>
      </div>

      <div className={cn(
        "relative flex items-center rounded-full overflow-hidden transition-all duration-300 backdrop-blur-xl z-20",
        isFocused 
          ? "bg-white shadow-2xl shadow-black/20 border-white/50" 
          : "bg-white/90 shadow-lg shadow-black/10 border-white/20 hover:bg-white",
        "border"
      )}>
        <div className={cn(
          "pl-6 pr-3 py-4 transition-colors",
          isFocused ? "text-blue-600" : "text-slate-400"
        )}>
          <Search size={24} strokeWidth={2.5} />
        </div>
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-lg text-slate-800 placeholder:text-slate-500 py-4"
          placeholder={user ? "搜索个人、团队或公共链接..." : `使用 ${searchEngine.name} 搜索...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && query.trim()) {
              // 如果没有本地搜索结果，使用搜索引擎搜索
              if (results.length === 0) {
                window.location.href = buildSearchUrl(searchEngine, query.trim());
              }
            }
          }}
        />
      </div>

      {/* Search Results Dropdown */}
      {isFocused && query.trim().length > 0 && (
        <div className="absolute top-full left-0 w-full mt-3 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* 搜索引擎选项 */}
          <a
            href={buildSearchUrl(searchEngine, query.trim())}
            className="flex items-center gap-4 px-6 py-3 hover:bg-slate-100/80 transition-colors group border-b border-slate-100"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
              <img 
                src={searchEngine.icon} 
                alt={searchEngine.name}
                className="w-5 h-5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <Globe size={18} className="hidden" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-medium text-slate-800">使用 {searchEngine.name} 搜索</h4>
              <p className="text-sm text-slate-500 truncate">{query}</p>
            </div>
            <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
          </a>

          {results.length > 0 ? (
            <ul className="py-3">
              <li className="px-6 py-2 text-xs text-slate-400 uppercase tracking-wider">本地链接</li>
              {results.map(link => (
                <li key={link.id}>
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 px-6 py-3 hover:bg-slate-100/80 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Search size={16} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-slate-800">{link.title}</h4>
                      <p className="text-sm text-slate-500 truncate">{link.url}</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-slate-500">
              <p className="text-sm">未找到本地链接，按 Enter 使用 {searchEngine.name} 搜索</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
