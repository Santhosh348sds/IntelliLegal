import React from 'react';

interface Props {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
}

const Pagination: React.FC<Props> = ({ total, page, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end   = Math.min(page * pageSize, total);

  return (
    <div style={styles.bar}>
      <span style={styles.info}>
        Showing {start}–{end} of {total} document{total !== 1 ? 's' : ''}
      </span>

      <div style={styles.controls}>
        <button
          style={{ ...styles.btn, ...(page === 1 ? styles.disabled : {}) }}
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
        >
          ‹ Prev
        </button>

        {pages.map((p) => (
          <button
            key={p}
            style={{ ...styles.btn, ...(p === page ? styles.active : {}) }}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}

        <button
          style={{ ...styles.btn, ...(page === totalPages ? styles.disabled : {}) }}
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
        >
          Next ›
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  info: { fontSize: 13, color: '#666' },
  controls: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  btn: {
    padding: '5px 11px',
    fontSize: 13,
    border: '1px solid #ddd',
    borderRadius: 5,
    background: '#fff',
    cursor: 'pointer',
    color: '#333',
    minWidth: 36,
    textAlign: 'center',
  },
  active: {
    background: '#0078d4',
    color: '#fff',
    border: '1px solid #0078d4',
    fontWeight: 700,
  },
  disabled: { color: '#bbb', cursor: 'default', background: '#fafafa' },
};

export default Pagination;
