import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { requireCompanyUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companyUser = await requireCompanyUser();

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "1px solid #e5ddce",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <strong>{companyUser.company.name}</strong>
          <nav style={{ display: "flex", gap: 16 }}>
            <Link href="/dashboard">Bibliothèque</Link>
            <Link href="/dashboard/questions">Questions</Link>
            <Link href="/dashboard/links">Liens de collecte</Link>
          </nav>
        </div>
        <UserButton afterSignOutUrl="/" />
      </header>
      <main style={{ padding: 24 }}>{children}</main>
    </div>
  );
}
