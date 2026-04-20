"use client";

import { useComplianceAlerts } from "@/src/hooks/useComplianceAlerts";
import { useSession } from "next-auth/react";
import { ROLES } from "@/src/lib/roles";

export function CompliancePageClient() {
  const { data: session } = useSession();
  const items = useComplianceAlerts();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isSupervisor = role === ROLES.SITE_SUPERVISOR;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Compliance Alerts</h2>
      <p className="text-sm text-slate-600">
        {isSupervisor
          ? "Summary-only compliance view for employees assigned to your site."
          : "Live document expiry status from database records."}
      </p>
      <div className="overflow-hidden rounded border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Employee</th>
              {isSupervisor ? (
                <>
                  <th className="p-2 text-left">Compliance Status</th>
                  <th className="p-2 text-left">Alert</th>
                  <th className="p-2 text-left">Nearest Expiry</th>
                </>
              ) : (
                <>
                  <th className="p-2 text-left">Document</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Alert</th>
                  <th className="p-2 text-left">Expiry</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-2">
                  <div className="font-medium">{item.employee?.fullName ?? "Employee"}</div>
                  <div className="text-xs text-slate-500">{item.employee?.employeeId ?? ""}</div>
                </td>
                {isSupervisor ? (
                  <>
                    <td className="p-2">{item.overallStatus ?? "-"}</td>
                    <td className="p-2">{item.alertLevel}</td>
                    <td className="p-2">
                      {item.daysToExpiry == null
                        ? "-"
                        : item.daysToExpiry < 0
                          ? `Overdue by ${Math.abs(item.daysToExpiry)} days`
                          : `In ${item.daysToExpiry} days`}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-2">{item.type}</td>
                    <td className="p-2">{item.status}</td>
                    <td className="p-2">{item.alertLevel}</td>
                    <td className="p-2">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "-"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? <p className="text-sm text-slate-500">No compliance records found.</p> : null}
    </div>
  );
}
