import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SetupForm from "@/components/SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) redirect("/login");

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <SetupForm />
    </div>
  );
}
