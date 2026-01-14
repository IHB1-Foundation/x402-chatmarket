import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>SoulForge</h1>
      <p>AI Persona &amp; Knowledge Module Marketplace</p>

      <div style={{ marginTop: '2rem' }}>
        <Link
          href="/marketplace"
          style={{
            display: 'inline-block',
            padding: '1rem 2rem',
            backgroundColor: '#0070f3',
            color: '#fff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '1.1rem',
          }}
        >
          Browse Marketplace
        </Link>
      </div>

      <hr style={{ margin: '2rem 0' }} />

      <h2>Quick Links</h2>
      <ul style={{ lineHeight: '2' }}>
        <li>
          <Link href="/marketplace" style={{ color: '#0070f3' }}>
            Marketplace - Browse AI Modules
          </Link>
        </li>
        <li>
          <Link href="/seller" style={{ color: '#0070f3' }}>
            Seller Dashboard - Create &amp; Manage Modules
          </Link>
        </li>
        <li>
          <Link href="/x402-poc" style={{ color: '#0070f3' }}>
            x402 POC - Payment Flow Demo
          </Link>
        </li>
      </ul>
    </main>
  );
}
