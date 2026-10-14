import { ChevronLeft, ChevronRight } from 'lucide-react';

// onPageChange(newPage) is optional. Screens that pass it get working
// Previous / Next buttons; screens that don't (still on placeholder data)
// render exactly as before.
export default function Pagination({ shown, total, noun, page, pages, onPageChange }) {
  return (
    <div className="pagination">
      <span className="muted">Showing <b>{shown}</b> of {total} {noun}</span>
      <div className="pagination__ctrl">
        <button className="link-btn" disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}><ChevronLeft size={14} /> Previous</button>
        <span className="muted small">Page {page} of {pages}</span>
        <button className="link-btn strong" disabled={page >= pages}
          onClick={() => onPageChange?.(page + 1)}>Next <ChevronRight size={14} /></button>
      </div>
    </div>
  );
}
