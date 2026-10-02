import { PageTransition } from "@/components/motion/page-transition";

// Templates remount on navigation, so each sidebar screen gets its entrance.
export default function ShellTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition className="min-h-full">{children}</PageTransition>;
}
