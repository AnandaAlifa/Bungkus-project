import { Metadata } from "next";
import { GroupBuyView } from "@/components/consumer/GroupBuyView";

interface Props {
  params: { group_id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `Bungkus Bareng — ${params.group_id} | Bungkus!`,
    description: "Ikutan Bungkus Bareng dan hemat hingga 70%!",
    openGraph: {
      title: "Bungkus Bareng!",
      description: "Ikutan grup beli & hemat bareng!",
      type: "website",
    },
  };
}

export default function GroupBuyPage({ params }: Props) {
  return <GroupBuyView groupId={params.group_id} />;
}
