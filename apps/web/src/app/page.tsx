import type { Module } from '@soulforge/shared';

export default function Home() {
  const testModule: Partial<Module> = {
    id: 'test',
    name: 'Test Module',
    type: 'base',
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SoulForge</h1>
      <p>AI Persona &amp; Knowledge Module Marketplace</p>
      <hr />
      <h2>Shared Package Test</h2>
      <pre>{JSON.stringify(testModule, null, 2)}</pre>
    </main>
  );
}
