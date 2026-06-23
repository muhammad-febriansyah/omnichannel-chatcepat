"use client";

import { UserPlus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionLink } from "@/components/app/action-link";
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
          <ActionLink href="/settings/users/new">
            <UserPlus className="size-4" /> Undang Anggota
          </ActionLink>
        </div>
        <UsersTable rows={users} />
      </TabsContent>
    </Tabs>
  );
}
