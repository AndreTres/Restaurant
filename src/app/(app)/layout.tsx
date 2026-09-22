import { TopNav } from "@/components/TopNav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <TopNav />
      {children}
    </div>
  );
}
