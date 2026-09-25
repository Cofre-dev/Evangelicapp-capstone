export function Footer() {
  return (
    <footer className="border-t border-border bg-card py-6">
      <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted-foreground sm:px-8">
        © {new Date().getFullYear()} Evangelicapp — Gestión administrativa y financiera para iglesias evangélicas.
      </div>
    </footer>
  );
}
