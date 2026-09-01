import { redirect } from "next/navigation";

export default async function NewDealRedirect({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const sp = await searchParams;
  redirect(`/deals?new=1${sp.customerId ? `&customerId=${sp.customerId}` : ""}`);
}
