'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { SkeletonGrid } from '../../components/ui/Skeleton';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch tags on mount
  useEffect(() => {
    fetch(`${API_URL}/api/modules/tags`)
      .then((res) => res.json())
      .then((data) => setTags(data.tags || []))
      .catch(() => setTags([]));
  }, []);

  // Show searching indicator
  useEffect(() => {
    if (searchQuery !== debouncedSearch) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [searchQuery, debouncedSearch]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedTag, sortBy]);

  // Fetch modules
  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (selectedTag) params.set('tag', selectedTag);
      params.set('sort', sortBy);
      params.set('page', currentPage.toString());
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
  }, [debouncedSearch, selectedTag, sortBy, currentPage]);

  const formatPrice = (amount: string, mode: string) => {
    const value = parseInt(amount, 10) / 1e6;
    return `$${value.toFixed(2)} / ${mode === 'per_message' ? 'msg' : 'session'}`;
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTag('');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const hasFilters = searchQuery || selectedTag || sortBy !== 'newest';

  // Separate featured modules
  const featuredModules = modules.filter((m) => m.featured);
  const regularModules = modules.filter((m) => !m.featured);

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
        <Card
          padding="md"
          className="mt-4 bg-[var(--color-background-secondary)]"
        >
          <div className="flex flex-col sm:flex-row gap-3 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-start gap-2 flex-1">
              <Badge variant="primary" size="sm" className="mt-0.5">Base</Badge>
              <span>Standalone module (buyer pays the creator directly).</span>
            </div>
            <div className="flex items-start gap-2 flex-1">
              <Badge variant="warning" size="sm" className="mt-0.5">Remix</Badge>
              <span>Derivative module that calls and pays an upstream module at runtime.</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftAddon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            rightAddon={
              isSearching ? (
                <svg className="w-4 h-4 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null
            }
            fullWidth
          />
        </div>
        <div className="flex gap-2">
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
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Tag Chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedTag('')}
            className={`
              px-3 py-1.5 text-sm rounded-[var(--radius-full)] transition-colors font-medium
              ${!selectedTag
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
              }
            `}
          >
            All
          </button>
          {tags.slice(0, 10).map((t) => (
            <button
              key={t.tag}
              onClick={() => setSelectedTag(selectedTag === t.tag ? '' : t.tag)}
              className={`
                px-3 py-1.5 text-sm rounded-[var(--radius-full)] transition-colors font-medium
                ${selectedTag === t.tag
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                }
              `}
            >
              {t.tag}
              <span className="ml-1 text-xs opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading State */}
      {loading && <SkeletonGrid count={6} />}

      {/* Error State */}
      {error && !loading && (
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
            {hasFilters
              ? 'Try adjusting your search or filters'
              : 'No modules have been published yet'}
          </p>
          {hasFilters && (
            <Button variant="secondary" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </Card>
      )}

      {/* Featured Section */}
      {!loading && !error && featuredModules.length > 0 && !selectedTag && !searchQuery && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Featured
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredModules.map((module) => (
              <ModuleCard key={module.id} module={module} formatPrice={formatPrice} />
            ))}
          </div>
        </div>
      )}

      {/* Regular Modules Grid */}
      {!loading && !error && regularModules.length > 0 && (
        <div>
          {featuredModules.length > 0 && !selectedTag && !searchQuery && (
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              All Modules
            </h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularModules.map((module) => (
              <ModuleCard key={module.id} module={module} formatPrice={formatPrice} />
            ))}
          </div>
        </div>
      )}

      {/* Show all modules when filtering */}
      {!loading && !error && modules.length > 0 && (selectedTag || searchQuery) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <ModuleCard key={module.id} module={module} formatPrice={formatPrice} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`
                    w-8 h-8 rounded-[var(--radius-md)] text-sm font-medium transition-colors
                    ${currentPage === pageNum
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-background-secondary)]'
                    }
                  `}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === pagination.totalPages}
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Results count */}
      {pagination && (
        <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-4">
          Showing {((currentPage - 1) * pagination.size) + 1}–{Math.min(currentPage * pagination.size, pagination.total)} of {pagination.total} modules
        </p>
      )}
    </div>
  );
}

// Module Card Component
function ModuleCard({
  module,
  formatPrice,
}: {
  module: Module;
  formatPrice: (amount: string, mode: string) => string;
}) {
  return (
    <Link href={`/marketplace/${module.id}`}>
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
              title={
                module.type === 'remix'
                  ? 'Remix: derivative module that calls and pays an upstream module at runtime.'
                  : 'Base: standalone module with its own persona + knowledge.'
              }
            >
              {module.type === 'remix' ? 'Remix' : 'Base'}
            </Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}
