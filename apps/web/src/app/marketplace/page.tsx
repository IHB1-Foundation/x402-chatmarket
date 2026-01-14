'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Module {
  id: string;
  type: string;
  name: string;
  description: string;
  tags: string[];
  pricingMode: string;
  priceAmount: string;
  network: string;
  evalScore: number | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function MarketplacePage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  // Fetch tags on mount
  useEffect(() => {
    fetch(`${API_URL}/api/modules/tags`)
      .then((res) => res.json())
      .then((data) => setTags(data.tags || []))
      .catch(() => setTags([]));
  }, []);

  // Fetch modules
  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (selectedTag) params.set('tag', selectedTag);
      params.set('sort', sortBy);
      params.set('size', '12');

      try {
        const res = await fetch(`${API_URL}/api/modules?${params}`);
        if (!res.ok) throw new Error('Failed to fetch modules');
        const data = await res.json();
        setModules(data.modules);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchModules();
  }, [searchQuery, selectedTag, sortBy]);

  const formatPrice = (amount: string, mode: string) => {
    const value = parseInt(amount, 10) / 1e6; // Assuming 6 decimals
    return `$${value.toFixed(2)} / ${mode === 'per_message' ? 'message' : 'session'}`;
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>SoulForge Marketplace</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#666' }}>Discover AI personas and knowledge modules</p>
        </div>
        <Link href="/" style={{ color: '#0070f3' }}>Home</Link>
      </div>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search modules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            flex: '1',
            minWidth: '200px',
          }}
        />
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="">All Tags</option>
          {tags.map((t) => (
            <option key={t.tag} value={t.tag}>
              {t.tag} ({t.count})
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="eval_score">Highest Rated</option>
        </select>
      </div>

      {/* Results */}
      {loading && <p>Loading modules...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {!loading && !error && modules.length === 0 && (
        <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
          No modules found. Try adjusting your search.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {modules.map((module) => (
          <Link
            key={module.id}
            href={`/marketplace/${module.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: '#fff',
                transition: 'box-shadow 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: '0 0 0.5rem' }}>{module.name}</h3>
                {module.evalScore !== null && (
                  <span
                    style={{
                      backgroundColor: '#e8f5e9',
                      color: '#2e7d32',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    {module.evalScore}/10
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 1rem', color: '#666', fontSize: '0.9rem', lineHeight: '1.4' }}>
                {module.description.length > 120
                  ? `${module.description.slice(0, 120)}...`
                  : module.description || 'No description'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {module.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      backgroundColor: '#f0f0f0',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', color: '#0070f3' }}>
                  {formatPrice(module.priceAmount, module.pricingMode)}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#999',
                    backgroundColor: module.type === 'remix' ? '#fff3e0' : '#e3f2fd',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                  }}
                >
                  {module.type}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} modules)
          </span>
        </div>
      )}
    </main>
  );
}
