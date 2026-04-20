"use client";
export function useSalaryPreview(basic:number,housing:number,transport:number){return {gross:basic+housing+transport};}
