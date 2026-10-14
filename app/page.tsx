'use client';

import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 select-none p-6">
      <div className="relative flex items-center justify-center pointer-events-none">
        <div className="absolute -inset-12 rounded-full border-4 border-dashed border-blue-500 animate-spin" style={{ animationDuration: '4s' }}></div>
        <div className="absolute -inset-6 rounded-full border-2 border-blue-200"></div>
        <div className="relative z-10 w-24 h-24 rounded-3xl overflow-hidden shadow-2xl bg-white border border-slate-100 flex items-center justify-center">
          <span className="text-3xl font-black text-blue-600 tracking-tight">G</span>
        </div>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return <App />;
}
