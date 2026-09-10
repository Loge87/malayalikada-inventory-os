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
  title: "Authentication error",
};

export default function AuthErrorPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              That confirmation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium underline">
              Back to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
