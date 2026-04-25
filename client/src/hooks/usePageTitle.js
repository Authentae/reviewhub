import { useEffect } from 'react';

export default function usePageTitle(title) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — ReviewHub` : 'ReviewHub';
    return () => { document.title = prev; };
  }, [title]);
}
