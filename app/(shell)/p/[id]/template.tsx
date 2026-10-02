import { PageTransition } from "@/components/motion/page-transition";

export default function ProjectTabTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition variant="tab">{children}</PageTransition>;
}
