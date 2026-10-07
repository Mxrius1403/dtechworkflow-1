import { ArrowRight, ClipboardList, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "Material Order Requests",
    description: "Review material requests submitted by technicians.",
    path: "/materials/requests",
    icon: ClipboardList,
    testId: "material-management-requests",
  },
  {
    title: "Product Management",
    description: "Manage the products available for material orders.",
    path: "/materials/products",
    icon: Package,
    testId: "material-management-products",
  },
];

export default function MaterialManagementPage() {
  return (
    <section className="mx-auto flex min-h-[55vh] max-w-4xl flex-col justify-center">
      <div className="mb-8 text-center">
        <p className="eyebrow mb-2">Materials</p>
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">Material Management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose an area to continue.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map(({ title, description, path, icon: Icon, testId }) => (
          <Link key={path} to={path} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId}>
            <Card className="h-full transition-colors group-hover:border-primary/50 group-hover:bg-muted/30 group-focus-visible:border-primary">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center justify-between gap-3 text-lg text-primary">
                  {title}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">Open</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
