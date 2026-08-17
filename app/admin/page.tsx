import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import AdminBootstrapModal from "@/components/admin/AdminBootstrapModal";

export const dynamic = "force-dynamic";

// Pre-auth bootstrap gateway only. Once a session exists, admin management lives at
// /settings?tab=admin — this route just decides where to send you.
export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      return (
        <div className="flex min-h-full flex-1 items-center justify-center p-6">
          <AdminBootstrapModal />
        </div>
      );
    }
    redirect("/login?next=/admin");
  }

  redirect(user.role === "admin" ? "/settings?tab=admin" : "/");
}
