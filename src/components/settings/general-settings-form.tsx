import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Organisation-wide settings live here as they come up. Currency moved to
 *  Price Settings, next to the pricing it affects. */
export function GeneralSettingsForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          There are no general settings yet. The default currency now lives in{" "}
          <Link
            href="/settings?tab=price-settings"
            className="font-medium underline"
          >
            Price Settings
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
