import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ExploreView from "@/components/ExploreView";
import SiteFooter from "@/components/SiteFooter";
import CategoryIcon from "@/components/CategoryIcon";
import { PageHeader } from "@/components/Section";
import { CATEGORY_PAGES, categoryBySlug } from "@/lib/categoryPages";
import { getCategoryColor } from "@/lib/categoryColors";

export function generateStaticParams() {
  return CATEGORY_PAGES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const cat = categoryBySlug((await params).slug);
  return cat
    ? { title: `${cat.label} events - EventEngine`, description: cat.blurb }
    : { title: "Category not found - EventEngine" };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const cat = categoryBySlug((await params).slug);
  if (!cat) notFound();
  const hue = getCategoryColor(cat.value);

  return (
    <>
      <div className="cat-hero" style={{ "--cat-hue": hue.color, "--cat-wash": hue.wash } as React.CSSProperties}>
        <PageHeader
          title={
            <>
              <span className="cat-hero-icon"><CategoryIcon category={cat.value} size={30} weight="fill" /></span>
              {cat.label}
            </>
          }
          lede={cat.blurb}
          crumbs={[{ label: "Home", href: "/" }, { label: "Categories", href: "/categories" }, { label: cat.label }]}
        />
      </div>
      <Suspense fallback={<div className="shell explore-fallback" />}>
        <ExploreView lockedCategory={cat.value} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
