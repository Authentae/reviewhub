// Colored pill chip for a review tag. color is a hex string like '#6b7280'.
// Clicking fires onRemove if provided (edit mode), otherwise it's static display.
// ariaLabel: optional explicit label when the visible text alone (just the tag
// name) doesn't convey the action — e.g. "Filter by tag: VIP" when the chip
// is a filter toggle, or "Remove filter: VIP" when already active.
import { useI18n } from '../context/I18nContext';

export default function TagBadge({ tag, onRemove, onClick, small, selected, ariaLabel }) {
  const { t } = useI18n();
  const hex = tag.color || '#6b7280';
  const style = selected
    ? { backgroundColor: hex, borderColor: hex, color: '#fff' }
    : { backgroundColor: hex + '22', borderColor: hex, color: hex };

  const base = small
    ? 'inline-flex items-center gap-0.5 rounded-full border text-[10px] font-medium px-1.5 py-0.5 leading-none'
    : 'inline-flex items-center gap-1 rounded-full border text-xs font-medium px-2 py-0.5 leading-none';

  if (onRemove) {
    return (
      <span className={base} style={style}>
        {tag.name}
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('tags.removeAria', 'Remove tag {name}', { name: tag.name })}
          className="ml-0.5 opacity-70 hover:opacity-100 leading-none"
        >×</button>
      </span>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || tag.name}
        aria-pressed={selected}
        className={`${base} cursor-pointer hover:opacity-80`}
        style={style}
      >
        {tag.name}
      </button>
    );
  }

  return <span className={base} style={style}>{tag.name}</span>;
}
