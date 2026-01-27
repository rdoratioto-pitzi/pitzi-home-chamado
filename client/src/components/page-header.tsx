import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface PageHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <Separator orientation="vertical" className="h-6" />
        
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <BreadcrumbItem key={index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
