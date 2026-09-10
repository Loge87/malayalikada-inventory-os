import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Check your email",
};

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          We&apos;ve sent you a confirmation link. Click it to activate your
          account, then sign in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/login" className="text-sm font-medium underline">
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
