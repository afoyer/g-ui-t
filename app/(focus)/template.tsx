import { PageTransition } from "@/components/motion/page-transition";

export default function FocusTemplate({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition variant="focus" className="flex min-h-0 flex-1 flex-col">
      {children}
    </PageTransition>
  );
}
