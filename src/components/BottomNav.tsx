import React from 'react';
import { TabType } from '../types';
import { LayoutDashboard, Settings } from 'lucide-react';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  return (
    <nav className="sticky bottom-0 w-full bg-white border-t border-slate-200 px-4 py-2 shadow-sm z-30 select-none">
      <div className="flex items-center justify-around max-w-sm mx-auto">
        <button
          onClick={() => onChangeTab('dashboard')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'dashboard' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => onChangeTab('settings')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'settings' 
              ? 'bg-blue-600 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};
