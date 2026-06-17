"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WebSettingsForm } from "@/components/app/web-settings-form";
import { BusinessHoursForm } from "@/components/app/business-hours-form";
import { UsersTable, type UserRow } from "@/components/app/users-table";
import type { WebSettings } from "@/lib/web-settings";
import type { BusinessHours } from "@/lib/business-hours";

// Pengaturan dalam tabs — form langsung, tanpa hop ke halaman terpisah.
export function SettingsTabs({
  webSettings,
  businessHours,
  users,
}: {
  webSettings: WebSettings;
  businessHours: BusinessHours;
  users: UserRow[];
}) {
  return (
    <Tabs defaultValue="web">
      <TabsList>
        <TabsTrigger value="web">Website</TabsTrigger>
        <TabsTrigger value="hours">Jam Kerja</TabsTrigger>
        <TabsTrigger value="team">Tim</TabsTrigger>
      </TabsList>

      <TabsContent value="web" className="pt-4">
        <WebSettingsForm initial={webSettings} />
      </TabsContent>

      <TabsContent value="hours" className="pt-4">
        <BusinessHoursForm initial={businessHours} />
      </TabsContent>

      <TabsContent value="team" className="pt-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Anggota Tim</h2>
            <p className="text-sm text-muted-foreground">{users.length} anggota · kelola akses & role.</p>
          </div>
          <Link
            href="/settings/users/new"
            className="flex items-center gap-2 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <UserPlus className="size-4" /> Undang Anggota
          </Link>
        </div>
        <UsersTable rows={users} />
      </TabsContent>
    </Tabs>
  );
}
