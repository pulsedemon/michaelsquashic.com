export function ProjectLink({ href }: { href: string }) {
  return (
    <a className="strong-link" href={href} target="_blank" rel="noreferrer">
      Visit {new URL(href).host}
    </a>
  );
}
