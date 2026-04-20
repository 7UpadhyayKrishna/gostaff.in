"use client";
import { useSalaryPreview } from "@/src/hooks/useSalaryPreview";
export function SalaryPreviewCard({basic,housing,transport}:{basic:number;housing:number;transport:number}){const p=useSalaryPreview(basic,housing,transport);return <div className="rounded border p-3">Gross AED {p.gross}</div>;}
