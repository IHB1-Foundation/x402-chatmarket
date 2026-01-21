'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SkeletonGrid } from '../../components/ui/Skeleton';

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
  featured: boolean;
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
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)} / ${mode === 'per_message' ? 'msg' : 'session'}`;
  };

  return (
    <div className="container-app py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Marketplace
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Discover AI personas and knowledge modules
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftAddon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            fullWidth
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] text-sm"
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
            className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="eval_score">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Tag Chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTag('')}
            className={`
              px-3 py-1 text-sm rounded-[var(--radius-full)] transition-colors
              ${!selectedTag
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
              }
            `}
          >
            All
          </button>
          {tags.slice(0, 8).map((t) => (
            <button
              key={t.tag}
              onClick={() => setSelectedTag(selectedTag === t.tag ? '' : t.tag)}
              className={`
                px-3 py-1 text-sm rounded-[var(--radius-full)] transition-colors
                ${selectedTag === t.tag
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                }
              `}
            >
              {t.tag}
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && <SkeletonGrid count={6} />}

      {/* Error State */}
      {error && (
        <Card variant="bordered" padding="lg" className="text-center">
          <div className="text-[var(--color-error)] mb-2">Failed to load modules</div>
          <p className="text-[var(--color-text-secondary)] text-sm">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && modules.length === 0 && (
        <Card variant="bordered" padding="lg" className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            No modules found
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Try adjusting your search or filters
          </p>
          <Button variant="secondary" onClick={() => { setSearchQuery(''); setSelectedTag(''); }}>
            Clear Filters
          </Button>
        </Card>
      )}

      {/* Module Grid */}
      {!loading && !error && modules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link key={module.id} href={`/marketplace/${module.id}`}>
              <Card
                hoverable
                padding="none"
                className={`
                  h-full overflow-hidden
                  ${module.featured ? 'ring-2 ring-[var(--color-primary)]' : ''}
                `}
              >
                {module.featured && (
                  <div className="bg-[var(--color-primary)] text-white text-xs font-medium px-3 py-1 text-center">
                    Featured
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-[var(--color-text-primary)] line-clamp-1">
                      {module.name}
                    </h3>
                    {module.evalScore !== null && (
                      <Badge
                        variant={module.evalScore >= 7 ? 'success' : module.evalScore >= 4 ? 'warning' : 'error'}
                        size="sm"
                      >
                        {module.evalScore}/10
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2 min-h-[2.5rem]">
                    {module.description || 'No description'}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {module.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" size="sm">
                        {tag}
                      </Badge>
                    ))}
                    {module.tags.length > 3 && (
                      <Badge variant="outline" size="sm">
                        +{module.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-border)]">
                    <span className="font-semibold text-[var(--color-primary)]">
                      {formatPrice(module.priceAmount, module.pricingMode)}
                    </span>
                    <Badge
                      variant={module.type === 'remix' ? 'warning' : 'primary'}
                      size="sm"
                    >
                      {module.type}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8 text-sm text-[var(--color-text-secondary)]">
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <span>•</span>
          <span>{pagination.total} modules</span>
        </div>
      )}
    </div>
  );
}
