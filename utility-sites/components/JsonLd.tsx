export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify is safe here because the data argument is constructed from typed input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
