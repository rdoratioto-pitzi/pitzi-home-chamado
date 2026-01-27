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

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9 rounded-lg hover:bg-muted" />
          <div className="h-6 w-px bg-border/60 mx-1" />
          
          <div className="flex flex-col">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <Breadcrumb>
                <BreadcrumbList className="text-[12px]">
                  {breadcrumbs.map((crumb, index) => (
                    <span key={index} className="contents">
                      {index > 0 && <BreadcrumbSeparator className="opacity-40" />}
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="font-semibold text-foreground">{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <h1 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h1>
            )}
            {description && !breadcrumbs && (
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {actions}
          <div className="h-8 w-px bg-border/40 mx-1" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
