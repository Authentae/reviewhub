interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <details
          key={i}
          className="group rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        >
          <summary className="cursor-pointer font-semibold text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
            {item.q}
          </summary>
          <p className="mt-2 text-gray-700 dark:text-gray-300">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
