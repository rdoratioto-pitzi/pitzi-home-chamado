import { Card, CardContent, CardFooter, Button, Badge } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestCardProps {
  title: string;
  description: string;
  onClick: () => void;
  href: string;
  badgeVariant: "primary" | "secondary" | "success" | "warning" | "error";
}

export function TestCard({ title, description, onClick, href, badgeVariant }: TestCardProps) {
  return (
    <Card className={cn("w-full")}>
      <CardContent>
        <div className={cn("flex justify-between items-center")}>
          <h2 className={cn("text-xl font-semibold")}>{title}</h2>
          <Badge variant={badgeVariant}>{badgeVariant}</Badge>
        </div>
        <p className={cn("mt-2 text-sm text-muted-foreground")}>{description}</p>
      </CardContent>
      <CardFooter className={cn("flex justify-between items-center")}>
        <Button variant="outline" onClick={onClick}>
          Action
        </Button>
        <Link href={href}>
          <Button variant="ghost" className={cn("flex items-center gap-1")}>
            <ArrowRight className={cn("h-4 w-4")} />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}