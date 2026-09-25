import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas2Editor } from '../../src/ui';
import './demo.css';

/** Standalone browser fixture: no Studio services or private documents. */
function Demo() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: '"Funnel Sans", sans-serif' }}>
    <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', background: '#18181b', color: 'white' }}>
      <span>Polimake Canvas · Espacios de trabajo</span>
      <button onClick={() => setTheme(value => value === 'light' ? 'dark' : 'light')}>Claro / oscuro</button>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      <Canvas2Editor pages layers theme={theme}
        pageSize={{ width: 1080, height: 1080 }}
        brandKit={{ mainColor: '#3a39f5', secondaryColor: '#e0533d' }} />
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Demo />);
