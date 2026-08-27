import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const delta = 1;
    const range = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) range.unshift('...');
    if (currentPage + delta < totalPages - 1) range.push('...');
    range.unshift(1);
    if (totalPages > 1 && !range.includes(totalPages)) range.push(totalPages);
    return range;
  };

  const pages = getPageNumbers();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      padding: '1rem 0',
      marginTop: '1.25rem',
      borderTop: '1px solid #e2e8f0',
      fontSize: '0.875rem',
      color: '#64748b'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span>
          Showing <strong>{startItem}</strong> - <strong>{endItem}</strong> of <strong>{totalItems}</strong> entries
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '0.8rem',
              marginLeft: '0.5rem',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value={5}>5 per page</option>
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </select>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: currentPage <= 1 ? '#f8fafc' : '#ffffff',
            color: currentPage <= 1 ? '#94a3b8' : '#0f172a',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          <ChevronLeft size={16} /> Prev
        </button>

        {pages.map((p, idx) => (
          <button
            key={idx}
            onClick={() => typeof p === 'number' && onPageChange(p)}
            disabled={p === '...'}
            style={{
              minWidth: '32px',
              height: '32px',
              padding: '0 0.35rem',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: p === currentPage ? '#0f172a' : '#cbd5e1',
              background: p === currentPage ? '#0f172a' : p === '...' ? 'transparent' : '#ffffff',
              color: p === currentPage ? '#ffffff' : '#334155',
              cursor: p === '...' ? 'default' : 'pointer',
              fontWeight: p === currentPage ? 700 : 500,
              fontSize: '0.8rem'
            }}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: currentPage >= totalPages ? '#f8fafc' : '#ffffff',
            color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
