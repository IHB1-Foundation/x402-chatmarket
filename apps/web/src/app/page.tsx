import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>SoulForge</h1>
      <p>AI Persona &amp; Knowledge Module Marketplace</p>
      <hr />
      <h2>Development Pages</h2>
      <ul>
        <li>
          <Link href="/x402-poc" style={{ color: '#0070f3' }}>
            x402 POC - Payment Flow Demo
          </Link>
        </li>
      </ul>
    </main>
  );
}
