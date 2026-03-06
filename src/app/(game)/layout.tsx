export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-terminal-bg text-terminal-green font-mono">
      {children}
    </div>
  );
}
