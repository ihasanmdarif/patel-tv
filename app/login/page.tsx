import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import LoginForm from "@/components/LoginForm";
import AdminBootstrapModal from "@/components/admin/AdminBootstrapModal";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const userCount = await prisma.user.count();

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      {userCount === 0 ? (
        <AdminBootstrapModal />
      ) : (
        <Suspense>
          <LoginForm />
        </Suspense>
      )}
    </div>
  );
}
