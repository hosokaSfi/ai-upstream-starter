import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn/ui の NativeSelect 相当(スマホでも OS 標準の選択 UI が出る) */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative inline-flex", className)}>
      <select
        className="border-input bg-background h-9 w-full appearance-none rounded-md border py-1 pr-8 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        {...props}
      />
      <ChevronDownIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2" />
    </div>
  );
}
export { NativeSelect };
