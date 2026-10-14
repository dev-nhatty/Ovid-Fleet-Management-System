// tone: green | gray | red | blue
export default function StatusBadge({ tone = 'gray', children }) {
  return (
    <span className={`badge badge--${tone}`}>
      <i className={`dot dot--${tone}`} /> {children}
    </span>
  );
}
