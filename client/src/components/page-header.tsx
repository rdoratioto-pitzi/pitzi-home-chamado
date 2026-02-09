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
    <div className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <Breadcrumb>
                <BreadcrumbList className="text-[13px]">
                  {breadcrumbs.map((crumb, index) => (
                    <span key={index} className="contents">
                      {index > 0 && <BreadcrumbSeparator className="opacity-40" />}
                      <BreadcrumbItem>
                        {crumb.href ? (
                          <BreadcrumbLink href={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="font-bold text-foreground text-[18px]">{crumb.label}</BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </span>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <h1 className="text-[20px] font-bold tracking-tight text-foreground leading-tight">{title}</h1>
            )}
            {description && !breadcrumbs && (
              <p className="text-[12px] text-muted-foreground leading-none mt-1">{description}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
