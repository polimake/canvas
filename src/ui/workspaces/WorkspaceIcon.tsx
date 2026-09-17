export function WorkspaceIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    elements: 'M3 3h7v7H3z M17 3l4 7h-8z M6.5 14a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7 M14 14h7v7h-7z',
    text: 'M4 5h16 M12 5v15 M8 20h8',
    brand: 'M5 4h14v16l-7-4-7 4z M9 8h6',
    design: 'M6 3h9l4 4v14H6z M14 3v5h5',
    layers: 'M3 7l9-4 9 4-9 4z M3 12l9 4 9-4 M3 17l9 4 9-4',
    library: 'M3 6h7l2 2h9v12H3z M3 6V4h7l2 2',
    components: 'M3 3h8v11H3z M15 3h6v6h-6z M3 18h8v3H3z M15 13h6v8h-6z',
    agent: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  };
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={paths[name] ?? paths.components} />
  </svg>;
}
