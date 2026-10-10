import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
import { diagnostics } from '../scripts/fixtures/supabase';
function Check() {
  const [state, setState] = useState({ ...diagnostics });
  useEffect(() => {
    const timer = setInterval(() => setState({ ...diagnostics }), 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <Home />
      <aside
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          zIndex: 100,
          background: 'white',
          border: '1px solid gray',
        }}
      >
        <output aria-label="测试写入次数">{state.saves}</output>
        <span>次测试保存（不写入云端）</span>
        <button
          onClick={() => {
            diagnostics.failNext = true;
          }}
        >
          模拟一次保存失败
        </button>
      </aside>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Check />);
