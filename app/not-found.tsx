import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">It may have been removed, or you may not have access to it.</p>
      <Button asChild><Link href="/">Go home</Link></Button>
    </div>
  );
}
