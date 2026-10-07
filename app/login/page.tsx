import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to the Visitas analytics dashboard.",
};

export default async function LoginPage() {
  const session = await getSessionUser();
  if (session) redirect("/");
  return <LoginForm />;
}
