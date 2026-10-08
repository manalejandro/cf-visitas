import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getSessionUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <Sidebar username={session.sub} />
      <div className="lg:pl-[248px]">
        <main className="mx-auto w-full max-w-[1440px] overflow-x-clip px-4 pb-20 pt-6 sm:px-6 lg:px-8 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
